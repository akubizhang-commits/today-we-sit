'use strict';
const { createProgress, validateProgress } = require('./schema');
const { migrateV1 } = require('./migrate');

const STORAGE_KEYS = Object.freeze({
  legacy: 'seating-progress', legacyBackup: 'seating-progress-v1-backup',
  current: 'seating-progress-v2', previous: 'seating-progress-v2-previous',
  candidate: 'seating-progress-v2-candidate', migration: 'seating-progress-v2-migration',
  reset: 'seating-progress-v2-reset'
});
const protectedKeys = ['current', 'previous', 'candidate', 'legacy', 'legacyBackup', 'reset'];
const queues = new WeakMap();
const catalogs = new WeakMap();
const clone = value => JSON.parse(JSON.stringify(value));
const usable = storage => storage && typeof storage.get === 'function' && typeof storage.set === 'function';
const failure = reason => ({ ok: false, reason });
const reasonFor = error => /quota|exceed|storage.*full/i.test(`${error && error.name} ${error && (error.message || error.errMsg)} ${error}`) ? 'quota' : 'unavailable';

// This serializes only callers sharing this adapter in this JS realm. get/set cannot
// provide cross-process CAS or database transactions. Never promote an orphan candidate.
function enqueue(storage, operation) {
  const next = (queues.get(storage) || Promise.resolve()).then(operation);
  queues.set(storage, next.catch(() => {}));
  return next;
}

async function read(storage, key) {
  try {
    const raw = await storage.get(key);
    if (raw === undefined || raw === null) return { present: false };
    try {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { present: true, raw, value, future: value && (value.version > 2 || value.schemaVersion > 2) };
    } catch (_) { return { present: true, raw, corrupt: true }; }
  } catch (error) {
    // Browser adapter parses JSON itself. A parse failure is recoverable corruption,
    // whereas an I/O failure means the unseen slot must not be overwritten.
    return error instanceof SyntaxError ? { present: true, corrupt: true } : { error };
  }
}

async function inspect(storage) {
  const entries = await Promise.all(protectedKeys.map(async name => [name, await read(storage, STORAGE_KEYS[name])]));
  return Object.fromEntries(entries);
}

function validSlot(slot, catalog) {
  if (!slot || !slot.value) return null;
  const checked = validateProgress(slot.value, catalog);
  return checked.ok ? checked : null;
}

async function writeVerified(storage, key, value, progress = false) {
  if (await storage.set(key, clone(value)) === false) throw new Error('Storage unavailable');
  const stored = await read(storage, key);
  if (stored.error) throw stored.error;
  // Compare the actual representation for backups (a legacy JSON string stays a string).
  if (JSON.stringify(stored.raw) !== JSON.stringify(value)
      || (progress && !validateProgress(stored.value).ok)) throw new Error('Storage readback verification failed');
}

async function commit(storage, snapshot, slots) {
  if (Object.values(slots).some(slot => slot.future)) return failure('invalid');
  if (Object.values(slots).some(slot => slot.error)) return failure('unavailable');
  if (slots.reset.present) return failure('invalid');
  const current = validSlot(slots.current);
  const previous = validSlot(slots.previous);
  if (!current && !previous) {
    if (slots.current.present || slots.previous.present) return failure('invalid');
    const legacySlots = [slots.legacy, slots.legacyBackup].filter(slot => slot.present);
    if (legacySlots.length && !legacySlots.some(slot => slot.value && (
      validSlot(slot) || (slot.value.version === 1 && Array.isArray(slot.value.completed)
        && slot.value.placements && typeof slot.value.placements === 'object' && !Array.isArray(slot.value.placements))
    ))) return failure('invalid');
  }
  try {
    // A previous load may have returned migrated in-memory progress after its
    // backup write failed. The subsequent autosave must honor backup-first too.
    if (!current && slots.legacy.present && !slots.legacyBackup.present) {
      if (slots.legacy.raw === undefined) return failure('invalid');
      await writeVerified(storage, STORAGE_KEYS.legacyBackup, slots.legacy.raw);
    }
    await writeVerified(storage, STORAGE_KEYS.candidate, snapshot, true);
    // Preserve the previous good snapshot BEFORE touching current. If current is
    // corrupt, leave the existing previous slot intact, even after a failed retry.
    if (current) await writeVerified(storage, STORAGE_KEYS.previous, current.value, true);
    await writeVerified(storage, STORAGE_KEYS.current, snapshot, true);
    return { ok: true, reason: null };
  } catch (error) { return failure(reasonFor(error)); }
}

/** Promise<{ok, reason:null|'quota'|'invalid'|'unavailable'}>.
 * Captures caller state immediately. Future schema slots block writes even without loadLocal.
 */
function saveLocal(storage, progress) {
  if (!usable(storage)) return Promise.resolve(failure('unavailable'));
  const checked = validateProgress(progress, catalogs.get(storage));
  if (!checked.ok || progress.readOnly === true) return Promise.resolve(failure('invalid'));
  return enqueue(storage, async () => commit(storage, checked.value, await inspect(storage)));
}

/** Promise<{progress,recovered,migrationWarnings,readOnly}>.
 * readOnly disables persistence; the caller may allow ephemeral play and warn the player.
 * Recovery never repairs
 * storage during load; the next explicit save keeps the recovered snapshot safe.
 */
function loadLocal(storage, catalog) {
  const fresh = () => ({ progress: createProgress(catalog), recovered: false, migrationWarnings: [], readOnly: false });
  if (!usable(storage)) return Promise.resolve({ ...fresh(), readOnly: true, migrationWarnings: ['Local storage unavailable'] });
  catalogs.set(storage, catalog);
  return enqueue(storage, async () => {
    const slots = await inspect(storage);
    const result = fresh();
    const future = Object.entries(slots).filter(([, slot]) => slot.future).map(([name]) => name);
    if (future.length) {
      result.readOnly = true;
      result.migrationWarnings.push(`Unsupported future schema version in ${future.join(', ')}; saving disabled`);
    }
    if (Object.values(slots).some(slot => slot.error)) {
      result.readOnly = true;
      result.migrationWarnings.push('Local storage read unavailable; saving disabled');
    }
    if (slots.reset.present) {
      result.readOnly = true;
      result.migrationWarnings.push('Local reset interrupted; retry reset to finish, saving disabled');
      return result;
    }
    for (const name of ['current', 'previous']) {
      const checked = validSlot(slots[name], catalog);
      if (!checked) continue;
      result.progress = checked.value;
      result.recovered = name === 'previous';
      result.migrationWarnings.push(...checked.issues);
      if (result.recovered) result.migrationWarnings.push('Recovered previous valid snapshot');
      return result;
    }
    for (const name of ['legacy', 'legacyBackup']) {
      if (!slots[name].present || slots[name].future) continue;
      let migrated;
      try { migrated = migrateV1(slots[name].value, catalog); }
      catch (error) { result.migrationWarnings.push(`Cannot migrate ${name}: ${error.message}`); continue; }
      result.progress = migrated.progress;
      result.recovered = name === 'legacyBackup' || slots.current.present || slots.previous.present;
      result.migrationWarnings.push(...migrated.warnings);
      if (result.readOnly) return result;
      try {
        // Write-once backup: neither this module nor a later migration overwrites it.
        if (!slots.legacyBackup.present) {
          await writeVerified(storage, STORAGE_KEYS.legacyBackup, slots[name].raw);
          slots.legacyBackup = { present: true, raw: slots[name].raw, value: slots[name].value };
        }
        // A corrupt new-format slot must not prevent recovery from a valid legacy backup.
        // commit still needs a good previous snapshot before replacing corrupt current.
        if (slots.current.present && !validSlot(slots.current) && !validSlot(slots.previous)) {
          await writeVerified(storage, STORAGE_KEYS.previous, migrated.progress, true);
          slots.previous = { present: true, value: migrated.progress };
        }
        const saved = await commit(storage, migrated.progress, slots);
        if (!saved.ok) result.migrationWarnings.push(`Migration not persisted: ${saved.reason}`);
        else await writeVerified(storage, STORAGE_KEYS.migration, { version: 2, complete: true });
      } catch (error) { result.migrationWarnings.push(`Migration not persisted: ${reasonFor(error)}`); }
      return result;
    }
    if (['current', 'previous', 'legacy', 'legacyBackup'].some(name => slots[name].present)) {
      result.readOnly = true;
      result.migrationWarnings.push('No readable committed progress; original data retained, saving disabled');
    }
    return result;
  });
}

/** Promise<{ok,reason:null|'quota'|'invalid'|'unavailable'}>.
 * Call only after the app's reset confirmation. Removes ONLY STORAGE_KEYS, never
 * storage.clear(). With no remove method, null tombstones represent absent keys.
 * A durable reset marker prevents interrupted deletion from resurrecting legacy
 * progress. On failure, retry resetLocal; on success loadLocal returns fresh data.
 * Unsupported future schemas are protected here too.
 */
function resetLocal(storage, catalog) {
  if (!usable(storage)) return Promise.resolve(failure('unavailable'));
  catalogs.set(storage, catalog);
  return enqueue(storage, async () => {
    const slots = await inspect(storage);
    if (Object.values(slots).some(slot => slot.future)) return failure('invalid');
    if (Object.values(slots).some(slot => slot.error)) return failure('unavailable');
    try {
      await writeVerified(storage, STORAGE_KEYS.reset, { version: 2, pending: true });
      for (const key of [...Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.reset), STORAGE_KEYS.reset]) {
        if (typeof storage.remove === 'function') await storage.remove(key);
        else await storage.set(key, null);
        const stored = await read(storage, key);
        if (stored.error) throw stored.error;
        if (stored.present) throw new Error('Storage removal verification failed');
      }
      return { ok: true, reason: null };
    } catch (error) { return failure(reasonFor(error)); }
  });
}

module.exports = { STORAGE_KEYS, loadLocal, saveLocal, resetLocal };
