'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createProgress, validateProgress } = require('../src/progress/schema');
const file = require('node:path').join(__dirname, '../src/progress/merge.js');
const { mergeProgress } = fs.existsSync(file) ? require(file) : {};
const catalog = { contentVersion: '1.0.0', campaignIds: ['bus-001', 'bus-002', 'garden-001'], dailyIds: ['daily-001'],
  chapters: [{ id: 'bus', levelIds: ['bus-001', 'bus-002'] }, { id: 'garden', levelIds: ['garden-001'] }],
  get: id => ({ id, revision: 1, people: [{ id: 'p1' }, { id: 'p2' }], seats: [{ id: 's1' }, { id: 's2' }] }) };
const snapshot = (sessionId, moveSequence, placement, savedAt = 0, contentRevision = 1) =>
  ({ sessionId, moveSequence, placement, savedAt, contentRevision });

test('merge exposes the documented API', () => { assert.equal(typeof mergeProgress, 'function'); });
test('known completed IDs union without a prefix and source snapshots stay immutable', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.completed = ['garden-001']; remote.completed = ['bus-001', 'alien', 'daily-001', 'bus-001'];
  local.chapterAccess = ['bus']; remote.chapterAccess = ['garden', 'unknown'];
  const before = structuredClone([local, remote]);
  const { merged } = mergeProgress(local, remote, catalog);
  assert.deepEqual(merged.completed, ['bus-001', 'garden-001']);
  assert.deepEqual(merged.chapterAccess, ['bus', 'garden']);
  assert.deepEqual([local, remote], before);
  assert.equal(merged.sync.pending, true);
});
test('domain unions prevent duplicate cards, tutorials, daily rewards and hint consumption', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.album = { claimedIds: ['card-5'], lastViewedId: 'card-5' };
  remote.album = { claimedIds: ['card-5', 'card-10'], remoteExtra: { retained: true } };
  local.tutorial.completedSteps = ['select']; remote.tutorial.completedSteps = ['select', 'place'];
  local.daily = { lastSeenDay: '2026-09-16', completedDays: ['2026-09-15'], cache: { local: 1 } };
  remote.daily = { lastSeenDay: '2026-09-15', completedDays: ['2026-09-15', '2026-09-16'], cache: { remote: 2 } };
  const grant = { grantId: 'g1', levelId: 'bus-001', source: 'initial' };
  local.hintAccess.grants = [grant]; remote.hintAccess.grants = [grant];
  remote.hintAccess.consumedIds = ['g1']; remote.hintAccess.fallbackClaimed = ['bus-001@1'];
  remote.hintAccess.receipts = { r1: { reason: 'window' } };
  local.settings.music = false; local.settings.extra = { size: 'large' };
  remote.settings.music = true; remote.settings.captions = true;
  const { merged } = mergeProgress(local, remote, catalog);
  assert.deepEqual(merged.album.claimedIds, ['card-5', 'card-10']);
  assert.deepEqual(merged.album.remoteExtra, { retained: true });
  assert.deepEqual(merged.tutorial.completedSteps, ['select', 'place']);
  assert.deepEqual(merged.daily.completedDays, ['2026-09-15', '2026-09-16']);
  assert.equal(merged.daily.lastSeenDay, '2026-09-16');
  assert.deepEqual(merged.daily.cache, { remote: 2, local: 1 });
  assert.equal(merged.hintAccess.grants.length, 1);
  assert.deepEqual(merged.hintAccess.consumedIds, ['g1']);
  assert.deepEqual(merged.hintAccess.fallbackClaimed, ['bus-001@1']);
  assert.deepEqual(merged.hintAccess.receipts, { r1: { reason: 'window' } });
  assert.equal(merged.settings.music, false);
  assert.equal(merged.settings.captions, true);
  assert.deepEqual(merged.settings.extra, { size: 'large' });
  assert.equal(validateProgress(merged, catalog).ok, true);
  assert.deepEqual(mergeProgress(merged, remote, catalog).merged.hintAccess, merged.hintAccess);
});
test('different sessions preserve both complete snapshots regardless of device clock', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.placements['bus-001'] = snapshot('local', 4, { p1: 's1' }, 1);
  remote.placements['bus-001'] = snapshot('remote', 100, { p2: 's2' }, 99999999);
  const result = mergeProgress(local, remote, catalog);
  assert.equal(result.placementConflicts.length, 1);
  assert.deepEqual(result.placementConflicts[0], { levelId: 'bus-001', local: local.placements['bus-001'], remote: remote.placements['bus-001'] });
  assert.deepEqual(result.merged.placements['bus-001'].placement, { p1: 's1' });
  assert.deepEqual(result.merged.placementConflicts, result.placementConflicts);
  assert.equal(mergeProgress(result.merged, remote, catalog).placementConflicts.length, 1);
  result.placementConflicts[0].remote.placement.p2 = 's1';
  assert.equal(remote.placements['bus-001'].placement.p2, 's2');
});
test('same session and content revision use moveSequence, never device timestamps', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.placements['bus-001'] = snapshot('shared', 5, { p1: 's1' }, 999999);
  remote.placements['bus-001'] = snapshot('shared', 6, { p2: 's2' }, 1);
  const result = mergeProgress(local, remote, catalog);
  assert.deepEqual(result.merged.placements['bus-001'].placement, { p2: 's2' });
  assert.equal(result.placementConflicts.length, 0);
});
test('same sequence divergent moves and different content revisions require conflict choice', () => {
  for (const contentRevision of [1, 2]) {
    const local = createProgress(catalog), remote = createProgress(catalog);
    local.placements['bus-001'] = snapshot('shared', 5, { p1: 's1' });
    remote.placements['bus-001'] = snapshot('shared', contentRevision === 1 ? 5 : 6, { p2: 's2' }, 0, contentRevision);
    const result = mergeProgress(local, remote, catalog);
    assert.equal(result.placementConflicts.length, 1);
    assert.equal(result.placementConflicts[0].remote.contentRevision, contentRevision);
  }
});
test('remote-only known board is copied and unknown boards are filtered', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  remote.placements['daily-001'] = snapshot('daily', 1, { p1: 's1' });
  remote.placements.unknown = snapshot('unknown', 1, { p1: 's1' });
  const result = mergeProgress(local, remote, catalog);
  assert.deepEqual(Object.keys(result.merged.placements), ['daily-001']);
  assert.deepEqual(result.merged.placements['daily-001'], remote.placements['daily-001']);
});
test('merge refuses future schemas and keeps local sync identity and revision', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.sync = { enabled: false, pending: false, serverRevision: 4, identity: 'local-user' };
  remote.sync = { enabled: true, pending: false, serverRevision: 100, identity: 'other-user' };
  const merged = mergeProgress(local, remote, catalog).merged;
  assert.equal(merged.sync.enabled, false);
  assert.equal(merged.sync.serverRevision, 4);
  assert.equal(merged.sync.identity, 'local-user');
  assert.throws(() => mergeProgress(local, { ...remote, version: 9 }, catalog), /version|schema/i);
});

test('a consumed remote grant retains its recoverable receipt when the local grant was unconsumed', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.hintAccess.grants = [{ grantId: 'g', levelId: 'bus-001', source: 'initial' }];
  remote.hintAccess.grants = [{ ...local.hintAccess.grants[0], hintReceipt: { placementRevision: 5, reason: 'window' }, recomputed: true }];
  remote.hintAccess.consumedIds = ['g'];
  const merged = mergeProgress(local, remote, catalog).merged;
  assert.deepEqual(merged.hintAccess.grants[0].hintReceipt, { placementRevision: 5, reason: 'window' });
  assert.equal(merged.hintAccess.grants[0].recomputed, true);
});
test('incompatible cloud content keeps both conflict snapshots instead of discarding the remote board', () => {
  const local = createProgress(catalog), remote = createProgress(catalog);
  local.placements['bus-001'] = snapshot('local', 1, { p1: 's1' });
  remote.placements['bus-001'] = snapshot('remote', 1, { futurePerson: 'futureSeat' }, 0, 9);
  const result = mergeProgress(local, remote, catalog);
  assert.equal(result.placementConflicts.length, 1);
  assert.deepEqual(result.placementConflicts[0].remote, remote.placements['bus-001']);
  assert.deepEqual(result.merged.placements['bus-001'], local.placements['bus-001']);
});
