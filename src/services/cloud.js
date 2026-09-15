'use strict';
const { validateProgress } = require('../progress/schema');
const { mergeProgress } = require('../progress/merge');
const clone = value => JSON.parse(JSON.stringify(value));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const revision = value => Number.isSafeInteger(value) && value >= 0;
const future = value => record(value) && (value.version > 2 || value.schemaVersion > 2);
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function wireProgress(progress) {
  const wire = clone(progress);
  // Authentication, local revision acknowledgement and pending queues are device-local.
  wire.sync = { enabled: false, serverRevision: null, pending: false };
  return wire;
}

/** No default backend, SDK, credential generation, timers, automatic retries or storage writes.
 * See docs/v1/cloud-contract.md for the provider responses and durable retry protocol.
 * @param {{provider?:object,catalog:object,persistPending?:Function}} options
 * @returns {{setSession:Function,sync:Function,getState:Function}}
 */
function createCloudClient({ provider, catalog, persistPending } = {}) {
  if (!catalog || typeof catalog.get !== 'function' || !Array.isArray(catalog.campaignIds)) throw new TypeError('A catalog is required');
  let session = null, epoch = 0, busy = false, status = 'idle', observedRevision = null;
  const operations = new Map();

  /** Supply only a session already authenticated by the provider's openSession adapter.
   * Changing/revoking a session invalidates late results. This is not authentication itself.
   * @param {{accountId:string,token:string}|null} value @returns {boolean}
   */
  function setSession(value) {
    epoch++; operations.clear(); observedRevision = null;
    session = record(value) && text(value.accountId) && typeof value.token === 'string' && value.token.length > 0
      ? { accountId: value.accountId, token: value.token } : null;
    status = session ? 'idle' : 'unauthorized';
    return session !== null;
  }
  const getState = () => ({ status, busy, authenticated: session !== null });

  // Persist this observation in the returned progress so a new client cannot
  // mistake a deleted record for a first upload. serverRevision remains the
  // last acknowledged write, not a GET/409 observation. The instance copy also
  // protects another attempt made with an older caller snapshot in this session.
  function rememberRevision(progress, ...values) {
    const known = [observedRevision, progress.sync.serverRevision, progress.sync.cloudObservedRevision, ...values].filter(revision);
    if (known.length) {
      observedRevision = Math.max(...known);
      progress.sync.cloudObservedRevision = observedRevision;
      progress.sync.cloudAccountId = session.accountId;
    }
  }

  function remoteGuard(progress, remote) {
    const known = progress.sync.cloudObservedRevision;
    if (revision(known) && remote.progress === null) return 'remote-missing';
    if (revision(known) && remote.serverRevision < known) return 'revision-regressed';
    return null;
  }

  function outcome(code, progress, extra = {}) {
    const result = { status: code, progress: progress && clone(progress), serverRevision: null,
      placementConflicts: [], pendingUpload: null, readOnly: code === 'future-schema', issues: [], ...extra };
    if (result.progress && result.progress.version === 2 && record(result.progress.sync) && code !== 'disabled') result.progress.sync.pending = code !== 'synced';
    return result;
  }

  async function fetchRemote(active) {
    let reply;
    try { reply = await provider.getProgress({ session: clone(active) }); }
    catch (_) { return { status: 'unavailable' }; }
    if (!record(reply)) return { status: 'invalid-response' };
    if (reply.status === 'unavailable' || reply.status === 'unauthorized') return { status: reply.status };
    if (reply.status !== 'ok') return { status: 'invalid-response' };
    if (reply.accountId !== active.accountId) return { status: 'identity-conflict' };
    if (future(reply.progress)) return { status: 'future-schema' };
    if (reply.progress === null && reply.serverRevision === null) return { status: 'ready', progress: null, serverRevision: null };
    if (!revision(reply.serverRevision) || reply.progress === null) return { status: 'invalid-response' };
    const checked = validateProgress(reply.progress);
    if (!checked.ok) return { status: 'invalid-remote', issues: checked.issues };
    // Pass the structurally validated original revisions to the real merge module.
    // Catalog reconciliation beforehand would erase content-version conflicts.
    return { status: 'ready', progress: checked.value, serverRevision: reply.serverRevision };
  }

  function combine(local, remote, resolutions) {
    let merged, placementConflicts;
    if (remote.progress) ({ merged, placementConflicts } = mergeProgress(local, remote.progress, catalog));
    else {
      const checked = validateProgress(local, catalog);
      merged = checked.value; placementConflicts = merged.placementConflicts || [];
    }
    if (placementConflicts.length && Array.isArray(resolutions)) {
      const selected = new Map();
      for (const conflict of placementConflicts) {
        const resolution = resolutions.find(item => record(item) && item.levelId === conflict.levelId
          && canonical(item.local) === canonical(conflict.local) && canonical(item.remote) === canonical(conflict.remote));
        if (!resolution || !['local', 'remote'].includes(resolution.choice)) return { merged, placementConflicts };
        const chosen = conflict[resolution.choice];
        const checked = validateProgress({ ...merged, placements: { [conflict.levelId]: chosen } }, catalog);
        const playable = checked.ok && checked.value.placements[conflict.levelId];
        if (!playable || canonical(playable.placement) !== canonical(chosen.placement)) return { merged, placementConflicts };
        if (selected.has(conflict.levelId) && canonical(selected.get(conflict.levelId)) !== canonical(playable)) return { merged, placementConflicts };
        selected.set(conflict.levelId, playable);
      }
      for (const [id, snapshot] of selected) Object.defineProperty(merged.placements, id, { value: snapshot, enumerable: true, writable: true, configurable: true });
      merged.placementConflicts = []; placementConflicts = [];
    }
    return { merged, placementConflicts };
  }

  /** One explicit foreground attempt: GET, merge/choice, CAS PUT, and at most one GET on 409.
   * Does not mutate the input. Persist progress AND pendingUpload on a failed PUT.
   * Retry requires that exact progress/pendingUpload and operationId (including after restart).
   * @param {object} local
   * @param {{operationId:string,resolutions?:object[],retry?:object}} options
   * @returns {Promise<{status:string,progress:object|null,serverRevision:number|null,
   * placementConflicts:object[],pendingUpload:object|null,readOnly:boolean,issues:string[]}>}
   */
  function sync(local, { operationId, resolutions = [], retry } = {}) {
    if (future(local)) {
      let copy = null; try { copy = clone(local); } catch (_) { /* Return no invalid JSON snapshot. */ }
      return Promise.resolve(outcome('future-schema', copy));
    }
    const checked = validateProgress(local);
    if (!checked.ok) return Promise.resolve(outcome('invalid-local', null, { issues: checked.issues }));
    const original = checked.value;
    if (original.readOnly === true) return Promise.resolve(outcome('read-only', original, { readOnly: true }));
    if (original.sync.enabled !== true) return Promise.resolve(outcome('disabled', original));
    if (!session) return Promise.resolve(outcome('unauthorized', original));
    if (original.sync.cloudAccountId && original.sync.cloudAccountId !== session.accountId) return Promise.resolve(outcome('identity-conflict', original));
    if (!provider || typeof provider.getProgress !== 'function' || typeof provider.putProgress !== 'function') return Promise.resolve(outcome('unavailable', original));
    if (!text(operationId)) return Promise.resolve(outcome('invalid-operation', original));
    if (busy) return Promise.resolve(outcome('busy', original));
    const active = clone(session), activeEpoch = epoch;
    const saved = operations.get(operationId);
    if (saved && saved.state !== 'pending') return Promise.resolve(outcome('invalid-operation', original));
    let ticket = retry || saved && saved.ticket;
    if (ticket) {
      try {
        if (!record(ticket) || ticket.accountId !== active.accountId || ticket.operationId !== operationId
          || !(ticket.expectedRevision === null || revision(ticket.expectedRevision)) || !validateProgress(ticket.progress).ok
          || canonical(wireProgress(original)) !== canonical(ticket.progress)
          || (saved && canonical(saved.ticket) !== canonical(ticket))) return Promise.resolve(outcome('invalid-operation', original));
        ticket = clone(ticket);
      } catch (_) { return Promise.resolve(outcome('invalid-operation', original)); }
    }
    busy = true; status = 'syncing';
    // Publish busy before even a synchronous provider callback can reenter sync.
    return run().then(result => {
      busy = false;
      if (epoch === activeEpoch) status = result.status;
      return result;
    }, () => {
      busy = false;
      if (epoch === activeEpoch) status = 'unavailable';
      return outcome('unavailable', original, { pendingUpload: ticket || null });
    });

    async function run() {
      rememberRevision(original, ticket && ticket.expectedRevision);
      const remote = await fetchRemote(active);
      if (epoch !== activeEpoch) return outcome('session-changed', original);
      if (remote.status !== 'ready') return outcome(remote.status, original, { issues: remote.issues || [], pendingUpload: ticket || null });
      const blocked = remoteGuard(original, remote);
      if (blocked) return outcome(blocked, original);
      rememberRevision(original, remote.serverRevision);
      let merged, placementConflicts;
      if (ticket) { merged = clone(original); placementConflicts = []; }
      else ({ merged, placementConflicts } = combine(original, remote, resolutions));
      merged.sync.cloudAccountId = active.accountId;
      merged.sync.pending = true;
      if (placementConflicts.length) return outcome('placement-conflict', merged, { serverRevision: remote.serverRevision, placementConflicts: clone(placementConflicts) });
      if (!ticket) ticket = { accountId: active.accountId, operationId, expectedRevision: remote.serverRevision, progress: wireProgress(merged) };
      operations.set(operationId, { state: 'pending', ticket: clone(ticket) });
      if (typeof persistPending === 'function') {
        let persisted;
        try { persisted = await persistPending({ progress: clone(merged), pendingUpload: clone(ticket) }); }
        catch (_) { /* No network write until durable local acknowledgement. */ }
        if (epoch !== activeEpoch) return outcome('session-changed', original);
        if (persisted !== true && !(record(persisted) && persisted.ok === true)) {
          return outcome('local-save-failed', merged, { pendingUpload: clone(ticket) });
        }
      }
      let ack;
      try {
        ack = await provider.putProgress({ session: clone(active), operationId: ticket.operationId,
          expectedRevision: ticket.expectedRevision, progress: clone(ticket.progress) });
      } catch (error) {
        ack = error && (error.status === 409 || error.statusCode === 409) ? { status: 'conflict' } : { status: 'unavailable' };
      }
      if (epoch !== activeEpoch) return outcome('session-changed', original);
      if (ack && (ack.status === 'conflict' || ack.status === 409)) {
        operations.set(operationId, { state: 'rejected', ticket });
        rememberRevision(merged, ack.serverRevision);
        const latest = await fetchRemote(active);
        if (epoch !== activeEpoch) return outcome('session-changed', original);
        if (latest.status !== 'ready') return outcome(latest.status, merged, { issues: latest.issues || [] });
        const blocked = remoteGuard(merged, latest);
        if (blocked) return outcome(blocked, merged);
        rememberRevision(merged, latest.serverRevision);
        const again = combine(merged, latest, []);
        return outcome(again.placementConflicts.length ? 'placement-conflict' : 'revision-conflict', again.merged,
          { serverRevision: latest.serverRevision, placementConflicts: clone(again.placementConflicts) });
      }
      if (!record(ack) || ack.status !== 'ok' || ack.accountId !== active.accountId || ack.operationId !== ticket.operationId
        || !revision(ack.serverRevision) || ack.serverRevision <= (ticket.expectedRevision === null ? -1 : ticket.expectedRevision)) {
        const code = ack && ['unavailable', 'unauthorized'].includes(ack.status) ? ack.status : 'invalid-response';
        return outcome(code, merged, { pendingUpload: clone(ticket) });
      }
      operations.set(operationId, { state: 'acknowledged', ticket });
      rememberRevision(merged, ack.serverRevision);
      // An idempotent replay can acknowledge an older write while this round's
      // GET already saw newer remote changes. Preserve them, and keep pending.
      const replayed = retry || saved;
      if (replayed && remote.progress) {
        const current = combine(merged, remote, []);
        const changed = canonical(wireProgress(current.merged)) !== canonical(ticket.progress);
        merged = current.merged;
        merged.sync.serverRevision = ack.serverRevision;
        const result = outcome(current.placementConflicts.length ? 'placement-conflict' : 'synced', merged,
          { serverRevision: ack.serverRevision, placementConflicts: clone(current.placementConflicts) });
        if (changed || remote.serverRevision > ack.serverRevision) result.progress.sync.pending = true;
        return result;
      }
      merged.sync.serverRevision = ack.serverRevision;
      return outcome('synced', merged, { serverRevision: ack.serverRevision });
    }
  }
  return { setSession, sync, getState };
}
module.exports = { createCloudClient };
