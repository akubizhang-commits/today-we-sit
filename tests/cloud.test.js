'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createProgress } = require('../src/progress/schema');
const { createCatalog } = require('../src/content/catalog');
const file = require('node:path').join(__dirname, '../src/services/cloud.js');
const { createCloudClient } = fs.existsSync(file) ? require(file) : {};
const catalog = createCatalog({ contentVersion: 'test', campaign: ['bus-001', 'garden-001'], daily: [], reserve: [] },
  ['bus-001', 'garden-001'].map(id => ({ id, chapterId: id.split('-')[0], revision: 1,
    people: [{ id: 'p1' }, { id: 'p2' }], seats: [{ id: 's1' }, { id: 's2' }] })));
const session = { accountId: 'account-a', token: 'opaque-authenticated-session' };
function progress(completed = []) { const p = createProgress(catalog); p.completed = completed; p.sync.enabled = true; return p; }
const board = (sessionId, placement, contentRevision = 1) => ({ sessionId, placement, contentRevision, moveSequence: 1, savedAt: 0 });
const clone = value => structuredClone(value);
function setup(remote = null, revision = null, overrides = {}) {
  const calls = { gets: [], puts: [] };
  const provider = {
    async getProgress(input) { calls.gets.push(clone(input)); return { status: 'ok', accountId: session.accountId, progress: clone(remote), serverRevision: revision }; },
    async putProgress(input) { calls.puts.push(clone(input)); return { status: 'ok', accountId: session.accountId, operationId: input.operationId, serverRevision: (input.expectedRevision || 0) + 1 }; },
    ...overrides
  };
  const client = createCloudClient({ provider, catalog }); client.setSession(session);
  return { client, provider, calls };
}

test('exports a provider-injected cloud client', () => { assert.equal(typeof createCloudClient, 'function'); });
test('missing provider is unavailable, never success, with local progress pending and intact', async () => {
  const client = createCloudClient({ catalog }); client.setSession(session);
  const local = progress(['bus-001']), before = clone(local);
  const result = await client.sync(local, { operationId: 'op1' });
  assert.equal(result.status, 'unavailable'); assert.equal(result.progress.sync.pending, true);
  assert.deepEqual(result.progress.completed, ['bus-001']); assert.deepEqual(local, before);
});
test('disabled consent and missing session make no provider calls', async () => {
  const { client, calls } = setup();
  const p = progress(); p.sync.enabled = false;
  assert.equal((await client.sync(p, { operationId: 'op1' })).status, 'disabled');
  client.setSession(null);
  assert.equal((await client.sync(progress(), { operationId: 'op2' })).status, 'unauthorized');
  assert.equal(calls.gets.length, 0); assert.equal(calls.puts.length, 0);
});
test('first upload requires an explicit missing record, authenticated account and exact acknowledgement', async () => {
  const { client, calls } = setup();
  const result = await client.sync(progress(['bus-001']), { operationId: 'first' });
  assert.equal(result.status, 'synced'); assert.equal(result.progress.sync.pending, false);
  assert.equal(result.progress.sync.serverRevision, 1);
  assert.equal(calls.puts[0].expectedRevision, null); assert.equal(calls.puts[0].operationId, 'first');
  assert.deepEqual(calls.puts[0].session, session);
});
test('real merge unions known noncontiguous completions and keeps local settings', async () => {
  const remote = progress(['garden-001', 'unknown']); remote.settings.music = true;
  const { client, calls } = setup(remote, 8);
  const local = progress(['bus-001']); local.settings.music = false;
  const before = clone(local);
  const result = await client.sync(local, { operationId: 'union' });
  assert.equal(result.status, 'synced'); assert.deepEqual(result.progress.completed, ['bus-001', 'garden-001']);
  assert.equal(calls.puts[0].expectedRevision, 8); assert.equal(calls.puts[0].progress.settings.music, false);
  assert.deepEqual(local, before);
});
test('corrupt, absent fields, wrong account and invalid revision responses never upload', async () => {
  for (const reply of [undefined, { status: 'ok' }, { status: 'ok', progress: null, serverRevision: 4, accountId: 'account-a' },
    { status: 'ok', progress: progress(), serverRevision: -1, accountId: 'account-a' },
    { status: 'ok', progress: { version: 2 }, serverRevision: 1, accountId: 'account-a' },
    { status: 'ok', progress: progress(), serverRevision: 1, accountId: 'other-account' }]) {
    const { client, calls } = setup(null, null, { getProgress: async () => reply });
    const result = await client.sync(progress(['bus-001']), { operationId: 'bad' });
    assert.notEqual(result.status, 'synced'); assert.equal(calls.puts.length, 0);
    assert.deepEqual(result.progress.completed, ['bus-001']); assert.equal(result.progress.sync.pending, true);
  }
});
test('future remote and local schemas refuse writing without downgrading their data', async () => {
  const { client, calls } = setup({ version: 99, newData: 'keep' }, 10);
  const result = await client.sync(progress(['bus-001']), { operationId: 'future' });
  assert.equal(result.status, 'future-schema'); assert.equal(result.readOnly, true);
  assert.deepEqual(result.progress.completed, ['bus-001']); assert.equal(calls.puts.length, 0);
  const other = setup();
  const future = { ...progress(), version: 99 };
  assert.equal((await other.client.sync(future, { operationId: 'local-future' })).status, 'future-schema');
  assert.equal(other.calls.gets.length, 0); assert.equal(future.version, 99);
});
test('different sessions return complete local and remote boards and do not upload', async () => {
  const local = progress(['bus-001']), remote = progress(['garden-001']);
  local.placements['bus-001'] = board('local', { p1: 's1' });
  remote.placements['bus-001'] = board('cloud', { p2: 's2' });
  const { client, calls } = setup(remote, 3);
  const result = await client.sync(local, { operationId: 'boards' });
  assert.equal(result.status, 'placement-conflict'); assert.equal(calls.puts.length, 0);
  assert.deepEqual(result.placementConflicts[0], { levelId: 'bus-001', local: local.placements['bus-001'], remote: remote.placements['bus-001'] });
  assert.deepEqual(result.progress.completed, ['bus-001', 'garden-001']);
});
test('explicit snapshot-bound local or remote choice uploads exactly the chosen board', async () => {
  for (const choice of ['local', 'remote']) {
    const local = progress(), remote = progress();
    local.placements['bus-001'] = board('local', { p1: 's1' });
    remote.placements['bus-001'] = board('remote', { p2: 's2' });
    const { client, calls } = setup(remote, 1);
    const conflict = await client.sync(local, { operationId: 'inspect' });
    const result = await client.sync(conflict.progress, { operationId: 'choose',
      resolutions: conflict.placementConflicts.map(item => ({ ...item, choice })) });
    assert.equal(result.status, 'synced');
    assert.deepEqual(calls.puts[0].progress.placements['bus-001'], choice === 'local' ? local.placements['bus-001'] : remote.placements['bus-001']);
    assert.deepEqual(result.progress.placementConflicts, []);
  }
});
test('a stale conflict choice cannot overwrite a newer cloud board', async () => {
  const local = progress(), remote = progress();
  local.placements['bus-001'] = board('local', { p1: 's1' }); remote.placements['bus-001'] = board('remote', { p2: 's2' });
  const { client, provider, calls } = setup(remote, 1);
  const first = await client.sync(local, { operationId: 'inspect' });
  remote.placements['bus-001'].placement = { p1: 's2' };
  provider.getProgress = async () => ({ status: 'ok', progress: remote, serverRevision: 2, accountId: 'account-a' });
  const result = await client.sync(first.progress, { operationId: 'choice', resolutions: first.placementConflicts.map(c => ({ ...c, choice: 'local' })) });
  assert.equal(result.status, 'placement-conflict'); assert.equal(calls.puts.length, 0);
});
test('incompatible content preserves the remote conflict, and cannot be selected for playback', async () => {
  const local = progress(), remote = progress();
  local.placements['bus-001'] = board('local', { p1: 's1' }); remote.placements['bus-001'] = board('future', { futurePerson: 'futureSeat' }, 4);
  const { client, calls } = setup(remote, 4);
  const first = await client.sync(local, { operationId: 'inspect' });
  assert.equal(first.placementConflicts[0].remote.contentRevision, 4);
  const result = await client.sync(first.progress, { operationId: 'choose', resolutions: first.placementConflicts.map(c => ({ ...c, choice: 'remote' })) });
  assert.equal(result.status, 'placement-conflict'); assert.equal(calls.puts.length, 0);
});
test('failed uploads preserve merged local progress and expose an exact credential-free retry envelope', async () => {
  const { client } = setup(progress(['garden-001']), 7, { putProgress: async () => { throw new Error('network contains SECRET'); } });
  const result = await client.sync(progress(['bus-001']), { operationId: 'retryable' });
  assert.equal(result.status, 'unavailable'); assert.equal(result.progress.sync.pending, true);
  assert.deepEqual(result.progress.completed, ['bus-001', 'garden-001']);
  assert.equal(result.pendingUpload.operationId, 'retryable'); assert.equal(result.pendingUpload.expectedRevision, 7);
  assert.equal(JSON.stringify(result).includes(session.token), false); assert.equal(JSON.stringify(result).includes('SECRET'), false);
});
test('acknowledgement loss retries the identical operation even across client reconstruction', async () => {
  const original = setup(progress(['garden-001']), 2, { putProgress: async () => { throw new Error('offline'); } });
  const failed = await original.client.sync(progress(['bus-001']), { operationId: 'persisted-op' });
  const next = setup(failed.pendingUpload.progress, 3);
  const retried = await next.client.sync(failed.progress, { operationId: 'persisted-op', retry: failed.pendingUpload });
  assert.equal(retried.status, 'synced'); assert.equal(next.calls.puts[0].expectedRevision, 2);
  assert.deepEqual(next.calls.puts[0].progress, failed.pendingUpload.progress);
  assert.equal(next.calls.puts[0].operationId, 'persisted-op');
});
test('operation ID cannot be reused for changed payload or another account', async () => {
  const { client, calls } = setup();
  await client.sync(progress(), { operationId: 'once' });
  assert.equal((await client.sync(progress(['bus-001']), { operationId: 'once' })).status, 'invalid-operation');
  assert.equal(calls.puts.length, 1);
  const p = progress(); p.sync.cloudAccountId = 'other-account';
  assert.equal((await client.sync(p, { operationId: 'other' })).status, 'identity-conflict');
});
test('409 performs one refetch and returns latest merged data without automatic blind retry', async () => {
  let gets = 0, puts = 0;
  const { client } = setup(null, null, {
    getProgress: async () => ({ status: 'ok', accountId: 'account-a', progress: gets++ === 0 ? progress() : progress(['garden-001']), serverRevision: gets }),
    putProgress: async () => { puts++; return { status: 'conflict', serverRevision: 2 }; }
  });
  const result = await client.sync(progress(['bus-001']), { operationId: 'conflict' });
  assert.equal(result.status, 'revision-conflict'); assert.equal(result.progress.sync.pending, true);
  assert.deepEqual(result.progress.completed, ['bus-001', 'garden-001']); assert.equal(result.serverRevision, 2);
  assert.equal(puts, 1); assert.equal(gets, 2); assert.equal(result.pendingUpload, null);
});
test('future schema discovered during 409 refetch is protected', async () => {
  let gets = 0, puts = 0;
  const { client } = setup(null, null, {
    getProgress: async () => ({ status: 'ok', accountId: 'account-a', progress: gets++ ? { version: 3 } : progress(), serverRevision: gets }),
    putProgress: async () => { puts++; return { status: 'conflict', serverRevision: 2 }; }
  });
  assert.equal((await client.sync(progress(), { operationId: 'race' })).status, 'future-schema'); assert.equal(puts, 1);
});
test('missing, mismatched or non-increasing write acknowledgement is never success', async () => {
  for (const ack of [undefined, { status: 'ok' }, { status: 'ok', operationId: 'wrong', accountId: 'account-a', serverRevision: 4 },
    { status: 'ok', operationId: 'op', accountId: 'account-a', serverRevision: 3 },
    { status: 'ok', operationId: 'op', accountId: 'other', serverRevision: 4 }]) {
    const { client } = setup(progress(), 3, { putProgress: async () => ack });
    const result = await client.sync(progress(['bus-001']), { operationId: 'op' });
    assert.notEqual(result.status, 'synced'); assert.equal(result.progress.sync.pending, true);
    assert.equal(result.progress.sync.serverRevision, null); assert.ok(result.pendingUpload);
  }
});
test('session change during fetch prevents upload and discards the foreign result', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const { client, calls } = setup(null, null, { getProgress: () => wait });
  const pending = client.sync(progress(['bus-001']), { operationId: 'late' });
  await Promise.resolve(); client.setSession({ accountId: 'account-b', token: 'new' });
  release({ status: 'ok', accountId: 'account-a', progress: progress(['garden-001']), serverRevision: 1 });
  const result = await pending;
  assert.equal(result.status, 'session-changed'); assert.equal(calls.puts.length, 0);
  assert.deepEqual(result.progress.completed, ['bus-001']);
});
test('concurrent sync is busy and never drops the second caller snapshot', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const { client } = setup(null, null, { getProgress: () => wait });
  const first = client.sync(progress(), { operationId: 'a' });
  const second = await client.sync(progress(['bus-001']), { operationId: 'b' });
  assert.equal(second.status, 'busy'); assert.deepEqual(second.progress.completed, ['bus-001']);
  release({ status: 'unavailable' }); await first;
});

test('previously synchronized records cannot be silently recreated after cloud deletion or revision rollback', async () => {
  for (const [remote, remoteRevision, want] of [[null, null, 'remote-missing'], [progress(), 2, 'revision-regressed']]) {
    const { client, calls } = setup(remote, remoteRevision);
    const local = progress(['bus-001']); local.sync.serverRevision = 5; local.sync.cloudAccountId = 'account-a';
    const result = await client.sync(local, { operationId: 'stale-device' });
    assert.equal(result.status, want); assert.equal(calls.puts.length, 0);
    assert.deepEqual(result.progress.completed, ['bus-001']); assert.equal(result.progress.sync.pending, true);
  }
});
test('optional pending persistence must acknowledge the complete retry envelope before any upload', async () => {
  let saved, puts = 0;
  const provider = {
    getProgress: async () => ({ status: 'ok', accountId: 'account-a', progress: null, serverRevision: null }),
    putProgress: async input => {
      puts++; assert.equal(saved.pendingUpload.operationId, input.operationId);
      assert.deepEqual(saved.pendingUpload.progress, input.progress);
      throw new Error('connection lost');
    }
  };
  const client = createCloudClient({ provider, catalog, persistPending: async snapshot => { saved = clone(snapshot); return { ok: true }; } });
  client.setSession(session);
  const result = await client.sync(progress(['bus-001']), { operationId: 'durable' });
  assert.equal(puts, 1); assert.equal(result.status, 'unavailable');
  assert.deepEqual(saved.pendingUpload, result.pendingUpload); assert.equal(saved.progress.sync.pending, true);
  for (const persistPending of [async () => false, async () => { throw new Error('quota'); }, async () => undefined]) {
    const blocked = createCloudClient({ provider, catalog, persistPending }); blocked.setSession(session);
    assert.equal((await blocked.sync(progress(), { operationId: 'blocked' })).status, 'local-save-failed');
  }
  assert.equal(puts, 1);
});
test('retry acknowledgement never discards progress discovered on its latest fetch', async () => {
  const first = setup(null, null, { putProgress: async () => { throw new Error('ack lost'); } });
  const failed = await first.client.sync(progress(['bus-001']), { operationId: 'old-op' });
  const next = setup(progress(['bus-001', 'garden-001']), 3);
  const result = await next.client.sync(failed.progress, { operationId: 'old-op', retry: failed.pendingUpload });
  assert.equal(result.status, 'synced');
  assert.deepEqual(result.progress.completed, ['bus-001', 'garden-001']);
  assert.equal(result.progress.sync.pending, true);
});
test('session changes during upload ignore acknowledgements and never expose old-session credentials', async () => {
  let started, finish;
  const began = new Promise(resolve => { started = resolve; });
  const waiting = new Promise(resolve => { finish = resolve; });
  const { client } = setup(null, null, { putProgress: () => { started(); return waiting; } });
  const request = client.sync(progress(['bus-001']), { operationId: 'late-put' });
  await began; client.setSession(null);
  finish({ status: 'ok', accountId: 'account-a', operationId: 'late-put', serverRevision: 1 });
  const result = await request;
  assert.equal(result.status, 'session-changed'); assert.equal(result.progress.sync.pending, true);
  assert.equal(result.progress.sync.serverRevision, null); assert.equal(result.pendingUpload, null);
  assert.equal(JSON.stringify(client.getState()).includes(session.token), false);
});
test('retry encountering a future schema never replays even a previously prepared operation', async () => {
  const first = setup(null, null, { putProgress: async () => { throw new Error('offline'); } });
  const failed = await first.client.sync(progress(), { operationId: 'old' });
  const next = setup({ version: 7 }, 8);
  const result = await next.client.sync(failed.progress, { operationId: 'old', retry: failed.pendingUpload });
  assert.equal(result.status, 'future-schema'); assert.equal(next.calls.puts.length, 0);
});

test('409 followed by deletion stays blocked on the next attempt and after client reconstruction', async () => {
  let gets = 0, puts = 0;
  const provider = {
    getProgress: async () => ++gets === 1
      ? { status: 'ok', accountId: 'account-a', progress: progress(['garden-001']), serverRevision: 5 }
      : { status: 'ok', accountId: 'account-a', progress: null, serverRevision: null },
    putProgress: async input => ++puts === 1 ? { status: 'conflict', serverRevision: 6 }
      : { status: 'ok', accountId: 'account-a', operationId: input.operationId, serverRevision: 1 }
  };
  const client = createCloudClient({ provider, catalog }); client.setSession(session);
  const local = progress(['bus-001']), before = clone(local);
  const first = await client.sync(local, { operationId: 'delete-race' });
  assert.equal(first.status, 'remote-missing');
  assert.equal(first.progress.sync.serverRevision, null, 'observing a revision is not a successful upload');
  assert.equal(first.progress.sync.pending, true); assert.equal(first.pendingUpload, null);
  assert.deepEqual(first.progress.completed, ['bus-001', 'garden-001']);
  assert.equal((await client.sync(local, { operationId: 'same-instance-old-input' })).status, 'remote-missing');
  const restarted = createCloudClient({ provider, catalog }); restarted.setSession(session);
  const second = await restarted.sync(clone(first.progress), { operationId: 'after-restart' });
  assert.equal(second.status, 'remote-missing'); assert.equal(puts, 1);
  assert.deepEqual(local, before);
});
test('409 refetch checks rollback against the conflict revision and preserves that floor for the next round', async () => {
  let gets = 0, puts = 0;
  const provider = {
    getProgress: async () => ({ status: 'ok', accountId: 'account-a', progress: progress(['garden-001']), serverRevision: ++gets === 1 ? 5 : 6 }),
    putProgress: async input => ++puts === 1 ? { status: 'conflict', serverRevision: 7 }
      : { status: 'ok', accountId: 'account-a', operationId: input.operationId, serverRevision: 7 }
  };
  const client = createCloudClient({ provider, catalog }); client.setSession(session);
  const first = await client.sync(progress(['bus-001']), { operationId: 'rollback-race' });
  assert.equal(first.status, 'revision-regressed'); assert.equal(first.progress.sync.serverRevision, null);
  assert.equal(first.pendingUpload, null); assert.equal(first.progress.sync.pending, true);
  const restarted = createCloudClient({ provider, catalog }); restarted.setSession(session);
  assert.equal((await restarted.sync(clone(first.progress), { operationId: 'after-rollback' })).status, 'revision-regressed');
  assert.equal(puts, 1);
  provider.getProgress = async () => ({ status: 'ok', accountId: 'account-a', progress: progress(['garden-001']), serverRevision: 7 });
  provider.putProgress = async input => { puts++; return { status: 'ok', accountId: 'account-a', operationId: input.operationId, serverRevision: 8 }; };
  assert.equal((await restarted.sync(first.progress, { operationId: 'after-recovery' })).status, 'synced');
});
test('failed 409 refetch still retains the observed record so a later missing response cannot recreate it', async () => {
  let gets = 0, puts = 0;
  const provider = {
    getProgress: async () => {
      gets++;
      if (gets === 1) return { status: 'ok', accountId: 'account-a', progress: progress(), serverRevision: 5 };
      if (gets === 2) throw new Error('offline');
      return { status: 'ok', accountId: 'account-a', progress: null, serverRevision: null };
    },
    putProgress: async input => ++puts === 1 ? { status: 'conflict' }
      : { status: 'ok', accountId: 'account-a', operationId: input.operationId, serverRevision: 1 }
  };
  const client = createCloudClient({ provider, catalog }); client.setSession(session);
  const first = await client.sync(progress(['bus-001']), { operationId: 'offline-refetch' });
  assert.equal(first.status, 'unavailable'); assert.equal(first.pendingUpload, null);
  const restarted = createCloudClient({ provider, catalog }); restarted.setSession(session);
  assert.equal((await restarted.sync(first.progress, { operationId: 'later' })).status, 'remote-missing');
  assert.equal(puts, 1);
});
