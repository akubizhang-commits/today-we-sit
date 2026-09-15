'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createProgress } = require('../src/progress/schema');
const file = require('node:path').join(__dirname, '../src/progress/repository.js');
const { loadLocal, saveLocal, STORAGE_KEYS } = fs.existsSync(file) ? require(file) : {};
const catalog = { contentVersion: '1.0.0', campaignIds: ['bus-001', 'garden-001'], dailyIds: [],
  chapters: [{ id: 'bus', levelIds: ['bus-001'] }, { id: 'garden', levelIds: ['garden-001'] }],
  get: id => ({ id, chapterId: id.split('-')[0], revision: 1, people: [{ id: 'p1' }], seats: [{ id: 's1' }] }) };
const copy = value => value === undefined ? undefined : structuredClone(value);
// Async get/set with durable writes, optionally failing before/after one write.
function memory(seed = {}, failure = {}) {
  const data = new Map(Object.entries(copy(seed)));
  let writes = 0;
  return { data,
    async get(key) {
      if (failure.getKey === key) throw failure.getError || new Error('unavailable');
      return copy(data.get(key));
    },
    async set(key, value) {
      writes++;
      if (writes === failure.at && !failure.after) {
        if (failure.returnsFalse) return false;
        throw new Error(failure.message || 'quota');
      }
      data.set(key, failure.corruptKey === key ? '{broken' : copy(value));
      if (writes === failure.at && failure.after) throw new Error('unavailable');
    }
  };
}
function progress(completed = []) { const p = createProgress(catalog); p.completed = completed; return p; }

test('repository exposes async load/save and named storage keys', () => {
  assert.equal(typeof loadLocal, 'function');
  assert.equal(typeof saveLocal, 'function');
  assert.equal(STORAGE_KEYS.legacy, 'seating-progress');
});
test('new install returns safe defaults without writing on load', async () => {
  const storage = memory();
  const loaded = await loadLocal(storage, catalog);
  assert.equal(loaded.recovered, false);
  assert.equal(loaded.readOnly, false);
  assert.deepEqual(loaded.progress.completed, []);
  assert.equal(storage.data.size, 0);
});
test('async snapshots roundtrip with previous complete snapshot retained', async () => {
  const storage = memory();
  const first = progress(['bus-001']);
  assert.deepEqual(await saveLocal(storage, first), { ok: true, reason: null });
  const second = progress(['bus-001', 'garden-001']);
  second.localRevision = 2;
  assert.deepEqual(await saveLocal(storage, second), { ok: true, reason: null });
  assert.deepEqual((await loadLocal(storage, catalog)).progress, second);
  assert.deepEqual(storage.data.get(STORAGE_KEYS.previous), first);
});
test('corrupt newest restores previous and a subsequent failed save cannot destroy it', async () => {
  const first = progress(['bus-001']);
  const storage = memory({ [STORAGE_KEYS.current]: '{bad', [STORAGE_KEYS.previous]: first });
  const loaded = await loadLocal(storage, catalog);
  assert.equal(loaded.recovered, true);
  assert.deepEqual(loaded.progress.completed, ['bus-001']);
  const broken = memory(Object.fromEntries(storage.data), { corruptKey: STORAGE_KEYS.current });
  assert.equal((await saveLocal(broken, progress(['garden-001']))).ok, false);
  assert.deepEqual((await loadLocal(broken, catalog)).progress.completed, ['bus-001']);
});
test('candidate, backup and commit interruption recover a complete old or committed snapshot', async () => {
  const first = progress(['bus-001']);
  const second = progress(['bus-001', 'garden-001']); second.localRevision = 2;
  for (const at of [1, 2, 3]) {
    const storage = memory({ [STORAGE_KEYS.current]: first }, { at });
    assert.equal((await saveLocal(storage, second)).ok, false);
    assert.deepEqual((await loadLocal(storage, catalog)).progress.completed, ['bus-001'], `before write ${at}`);
  }
  const committed = memory({ [STORAGE_KEYS.current]: first }, { at: 3, after: true });
  await saveLocal(committed, second);
  assert.deepEqual((await loadLocal(committed, catalog)).progress.completed, ['bus-001', 'garden-001']);
});
test('orphaned candidates never promote an uncommitted move', async () => {
  const storage = memory({ [STORAGE_KEYS.candidate]: progress(['garden-001']) });
  assert.deepEqual((await loadLocal(storage, catalog)).progress.completed, []);
});
test('quota, false writes, invalid data and unavailable storage have distinct failure results', async () => {
  assert.deepEqual(await saveLocal(memory({}, { at: 1 }), progress()), { ok: false, reason: 'quota' });
  assert.deepEqual(await saveLocal(memory({}, { at: 1, returnsFalse: true }), progress()), { ok: false, reason: 'unavailable' });
  assert.deepEqual(await saveLocal(memory(), { version: 2 }), { ok: false, reason: 'invalid' });
  assert.deepEqual(await saveLocal(null, progress()), { ok: false, reason: 'unavailable' });
  const result = await loadLocal(null, catalog);
  assert.equal(result.readOnly, true);
  assert.ok(result.migrationWarnings.length);
});
test('readback corruption prevents candidate from becoming the current snapshot', async () => {
  const storage = memory({ [STORAGE_KEYS.current]: progress(['bus-001']) }, { corruptKey: STORAGE_KEYS.candidate });
  assert.equal((await saveLocal(storage, progress(['garden-001']))).ok, false);
  assert.deepEqual((await loadLocal(storage, catalog)).progress.completed, ['bus-001']);
});
test('legacy bytes are backed up unchanged before migration and never overwritten on reentry', async () => {
  const raw = JSON.stringify({ version: 1, currentLevel: 11, completed: [1], placements: {} });
  const storage = memory({ [STORAGE_KEYS.legacy]: raw });
  const first = await loadLocal(storage, catalog);
  assert.equal(first.progress.currentLevelId, 'garden-001');
  assert.equal(storage.data.get(STORAGE_KEYS.legacy), raw);
  assert.equal(storage.data.get(STORAGE_KEYS.legacyBackup), raw);
  storage.data.set(STORAGE_KEYS.legacy, { version: 1, currentLevel: 1, completed: [], placements: {} });
  assert.deepEqual((await loadLocal(storage, catalog)).progress, first.progress);
  assert.equal(storage.data.get(STORAGE_KEYS.legacyBackup), raw);
});
test('every interrupted migration preserves readable legacy and supports retry', async () => {
  const legacy = { version: 1, currentLevel: 11, completed: [1], placements: {} };
  for (const at of [1, 2, 3, 4]) {
    const storage = memory({ [STORAGE_KEYS.legacy]: legacy }, { at });
    const first = await loadLocal(storage, catalog);
    assert.deepEqual(first.progress.completed, ['bus-001']);
    assert.equal(first.progress.currentLevelId, 'garden-001');
    assert.deepEqual(storage.data.get(STORAGE_KEYS.legacy), legacy);
    const retry = memory(Object.fromEntries(storage.data));
    assert.equal((await loadLocal(retry, catalog)).progress.currentLevelId, 'garden-001');
  }
});
test('backup write failure prevents any v2 migration commit', async () => {
  const storage = memory({ [STORAGE_KEYS.legacy]: { version: 1, currentLevel: 1, completed: [1], placements: {} } }, { at: 1 });
  const loaded = await loadLocal(storage, catalog);
  assert.deepEqual(loaded.progress.completed, ['bus-001']);
  assert.ok(loaded.migrationWarnings.length);
  assert.equal(storage.data.has(STORAGE_KEYS.current), false);
});
test('future schemas in any protected slot are read-only and cannot be downgraded even without load', async () => {
  for (const key of [STORAGE_KEYS.current, STORAGE_KEYS.previous, STORAGE_KEYS.candidate, STORAGE_KEYS.legacy, STORAGE_KEYS.legacyBackup]) {
    const future = { version: 99, secretFutureState: { complete: true } };
    const storage = memory({ [STORAGE_KEYS.previous]: progress(['bus-001']), [key]: JSON.stringify(future) });
    const before = copy(Object.fromEntries(storage.data));
    assert.deepEqual(await saveLocal(storage, progress()), { ok: false, reason: 'invalid' });
    const loaded = await loadLocal(storage, catalog);
    assert.equal(loaded.readOnly, true, key);
    assert.ok(loaded.migrationWarnings.some(w => /version|schema/i.test(w)));
    assert.deepEqual(await saveLocal(storage, loaded.progress), { ok: false, reason: 'invalid' });
    assert.deepEqual(Object.fromEntries(storage.data), before);
  }
});
test('transient read failure cannot be treated as empty storage and overwritten', async () => {
  const storage = memory({ [STORAGE_KEYS.current]: progress(['bus-001']) }, { getKey: STORAGE_KEYS.current });
  assert.equal((await loadLocal(storage, catalog)).readOnly, true);
  assert.deepEqual(await saveLocal(storage, progress()), { ok: false, reason: 'unavailable' });
  assert.deepEqual(storage.data.get(STORAGE_KEYS.current).completed, ['bus-001']);
});
test('adapter JSON parse error in newest recovers previous instead of crashing', async () => {
  const storage = memory({ [STORAGE_KEYS.previous]: progress(['bus-001']) },
    { getKey: STORAGE_KEYS.current, getError: new SyntaxError('Unexpected token') });
  const loaded = await loadLocal(storage, catalog);
  assert.equal(loaded.recovered, true);
  assert.deepEqual(loaded.progress.completed, ['bus-001']);
});
test('concurrent async saves serialize and detach caller state at invocation', async () => {
  const storage = memory();
  const first = progress(['bus-001']);
  const second = progress(['bus-001', 'garden-001']); second.localRevision = 2;
  const a = saveLocal(storage, first);
  const b = saveLocal(storage, second);
  second.completed.length = 0;
  assert.equal((await a).ok, true); assert.equal((await b).ok, true);
  assert.deepEqual((await loadLocal(storage, catalog)).progress.completed, ['bus-001', 'garden-001']);
  assert.deepEqual(storage.data.get(STORAGE_KEYS.previous).completed, ['bus-001']);
});

test('unreadable legacy cannot be silently masked by saving fresh defaults', async () => {
  const storage = memory({ [STORAGE_KEYS.legacy]: '{broken' });
  const loaded = await loadLocal(storage, catalog);
  assert.equal(loaded.readOnly, true);
  assert.deepEqual(await saveLocal(storage, loaded.progress), { ok: false, reason: 'invalid' });
  assert.equal(storage.data.has(STORAGE_KEYS.current), false);
});
test('reset only removes owned keys, supports remove or set(null), and loads fresh afterward', async () => {
  const { resetLocal } = require('../src/progress/repository');
  assert.equal(typeof resetLocal, 'function');
  for (const hasRemove of [false, true]) {
    const storage = memory({ [STORAGE_KEYS.current]: progress(['bus-001']),
      [STORAGE_KEYS.legacy]: { version: 1, currentLevel: 1, completed: [1], placements: {} }, unrelated: { keep: true } });
    if (hasRemove) storage.remove = async key => storage.data.delete(key);
    assert.deepEqual(await resetLocal(storage, catalog), { ok: true, reason: null });
    const loaded = await loadLocal(storage, catalog);
    assert.deepEqual(loaded.progress.completed, []);
    assert.equal(loaded.readOnly, false);
    assert.deepEqual(storage.data.get('unrelated'), { keep: true });
    assert.equal((await saveLocal(storage, progress(['garden-001']))).ok, true);
  }
});
test('interrupted reset cannot resurrect old progress and an explicit retry finishes safely', async () => {
  const { resetLocal } = require('../src/progress/repository');
  assert.equal(typeof resetLocal, 'function');
  const seed = { [STORAGE_KEYS.current]: progress(['bus-001']),
    [STORAGE_KEYS.legacy]: { version: 1, currentLevel: 1, completed: [1], placements: {} }, unrelated: 1 };
  for (const at of [2, 3, 4, 5, 6, 7, 8]) {
    const storage = memory(seed, { at });
    assert.equal((await resetLocal(storage, catalog)).ok, false);
    const loaded = await loadLocal(storage, catalog);
    assert.deepEqual(loaded.progress.completed, [], `interrupted reset ${at}`);
    assert.equal(loaded.readOnly, true);
    assert.equal((await saveLocal(storage, progress())).ok, false);
    const retry = memory(Object.fromEntries(storage.data));
    assert.equal((await resetLocal(retry, catalog)).ok, true);
    assert.equal((await loadLocal(retry, catalog)).readOnly, false);
    assert.equal(retry.data.get('unrelated'), 1);
  }
});
test('reset rejects future schemas without touching any key', async () => {
  const { resetLocal } = require('../src/progress/repository');
  assert.equal(typeof resetLocal, 'function');
  const storage = memory({ [STORAGE_KEYS.current]: { version: 9, future: 'kept' }, unrelated: 1 });
  const before = Object.fromEntries(storage.data);
  assert.deepEqual(await resetLocal(storage, catalog), { ok: false, reason: 'invalid' });
  assert.deepEqual(Object.fromEntries(storage.data), before);
});

test('autosave after interrupted migration still backs up the original legacy bytes first', async () => {
  const raw = '{"version":1,"currentLevel":1,"completed":[1],"placements":{}}';
  const storage = memory({ [STORAGE_KEYS.legacy]: raw }, { at: 1 });
  const loaded = await loadLocal(storage, catalog);
  assert.equal(storage.data.has(STORAGE_KEYS.legacyBackup), false);
  assert.equal((await saveLocal(storage, loaded.progress)).ok, true);
  assert.equal(storage.data.get(STORAGE_KEYS.legacyBackup), raw);
  assert.equal(storage.data.get(STORAGE_KEYS.legacy), raw);
});
test('reset removal failures preserve the marker and unrelated data', async () => {
  const { resetLocal } = require('../src/progress/repository');
  const storage = memory({ [STORAGE_KEYS.current]: progress(['bus-001']), unrelated: 'keep' });
  storage.remove = async () => false;
  assert.deepEqual(await resetLocal(storage, catalog), { ok: false, reason: 'unavailable' });
  assert.equal((await loadLocal(storage, catalog)).readOnly, true);
  assert.equal(storage.data.get('unrelated'), 'keep');
});
