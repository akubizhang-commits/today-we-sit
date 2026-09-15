'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const daily = require('../src/features/daily');
const { createCatalog } = require('../src/content/catalog');
const { evaluate } = require('../src/core/engine');
const ids = Array.from({ length: 14 }, (_, i) => `daily-${String(i + 1).padStart(3, '0')}`);
function fixture() {
  const levels = ids.map(id => ({ id, revision: 1, kind: 'daily', chapterId: 'bus',
    seats: [{ id: 's1', x: 0, y: 0, tags: ['window'] }, { id: 's2', x: 1, y: 0, tags: [] }],
    adjacency: [['s1', 's2']],
    people: [{ id: 'p1', rules: [{ type: 'tag', value: 'window' }] }, { id: 'p2', rules: [{ type: 'adjacent', person: 'p1' }] }]
  }));
  const catalog = createCatalog({ campaign: [], daily: ids, chapters: [], dailyCycleAnchorDay: '2026-09-15' }, levels);
  return { catalog, progress: { placements: {}, daily: { completedDays: [] } } };
}
const snapshot = (dayKey, placement = { p1: 's1' }, extra = {}) => ({ dayKey, placement,
  contentRevision: 1, sessionId: 'session', moveSequence: 1, savedAt: 0, ...extra });
const resume = (progress, catalog, today = '2026-09-20') => daily.findResume(progress, catalog, today);

test('returns the latest eligible old day, independently of insertion order, current level and savedAt', () => {
  const { progress, catalog } = fixture();
  progress.currentLevelId = 'bus-001';
  progress.placements[ids[3]] = snapshot('2026-09-18', undefined, { savedAt: 1 });
  progress.placements[ids[0]] = snapshot('2026-09-15', undefined, { savedAt: 999999 });
  assert.deepEqual(resume(progress, catalog), { levelId: ids[3], dayKey: '2026-09-18' });
});
test('anchor day is resumable but today, future dates, pre-anchor and impossible dates are not', () => {
  for (const day of ['2026-09-14', '2026-09-20', '2026-09-21', '2026-02-30', '2026-9-15', null]) {
    const { progress, catalog } = fixture();
    progress.placements[ids[0]] = snapshot(day);
    assert.equal(resume(progress, catalog), null, String(day));
  }
  const { progress, catalog } = fixture();
  progress.placements[ids[0]] = snapshot('2026-09-15');
  assert.deepEqual(resume(progress, catalog, '2026-09-16'), { levelId: ids[0], dayKey: '2026-09-15' });
});
test('uses the catalog order and anchor across repeated cycles rather than ID arithmetic', () => {
  const { progress, catalog } = fixture();
  const reordered = { ...catalog, dailyIds: [...ids].reverse(), dailyCycleAnchorDay: '2026-09-16' };
  progress.placements[ids[13]] = snapshot('2026-09-30');
  assert.deepEqual(resume(progress, reordered, '2026-10-01'), { levelId: ids[13], dayKey: '2026-09-30' });
  assert.equal(resume(progress, catalog, '2026-10-01'), null);
});
test('skips completed day and continues to the next most recent candidate', () => {
  const { progress, catalog } = fixture();
  progress.placements[ids[2]] = snapshot('2026-09-17');
  progress.placements[ids[1]] = snapshot('2026-09-16');
  progress.daily.completedDays = ['2026-09-17'];
  assert.deepEqual(resume(progress, catalog), { levelId: ids[1], dayKey: '2026-09-16' });
});
test('completion is day-specific, not a ban on replaying the same level in another cycle', () => {
  const { progress, catalog } = fixture();
  progress.daily.completedDays = ['2026-09-15'];
  progress.completed = [ids[0]];
  progress.placements[ids[0]] = snapshot('2026-09-29');
  assert.deepEqual(resume(progress, catalog, '2026-09-30'), { levelId: ids[0], dayKey: '2026-09-29' });
});
test('skips a solved layout even if its day is not yet recorded complete', () => {
  const { progress, catalog } = fixture();
  const solved = { p1: 's1', p2: 's2' };
  assert.equal(evaluate(catalog.get(ids[0]), solved).complete, true);
  progress.placements[ids[0]] = snapshot('2026-09-15', solved);
  assert.equal(resume(progress, catalog), null);
});
test('a fully seated but conflicting layout can resume', () => {
  const { progress, catalog } = fixture();
  progress.placements[ids[0]] = snapshot('2026-09-15', { p1: 's2', p2: 's1' });
  assert.deepEqual(resume(progress, catalog), { levelId: ids[0], dayKey: '2026-09-15' });
});
test('empty, malformed, unknown-seat, unknown-person and double-booked layouts are not resumed', () => {
  for (const placement of [{}, null, [], 'bad', { ghost: 's1' }, { p1: 'gone' }, { p1: 's1', p2: 's1' }]) {
    const { progress, catalog } = fixture();
    progress.placements[ids[0]] = snapshot('2026-09-15', placement);
    assert.equal(resume(progress, catalog), null, JSON.stringify(placement));
  }
});
test('requires exact content revision and skips stale newest entry', () => {
  for (const revision of [0, 2, '1', null, undefined]) {
    const { progress, catalog } = fixture();
    progress.placements[ids[1]] = snapshot('2026-09-16', undefined, { contentRevision: revision });
    progress.placements[ids[0]] = snapshot('2026-09-15');
    assert.deepEqual(resume(progress, catalog), { levelId: ids[0], dayKey: '2026-09-15' });
  }
});
test('excludes campaign, unknown, missing-catalog and wrongly mapped daily entries', () => {
  const { progress, catalog } = fixture();
  progress.placements['bus-001'] = snapshot('2026-09-15');
  progress.placements['daily-missing'] = snapshot('2026-09-15');
  progress.placements[ids[0]] = snapshot('2026-09-16');
  progress.placements[ids[2]] = null;
  assert.equal(resume(progress, catalog), null);
  progress.placements[ids[0]] = snapshot('2026-09-15');
  assert.equal(resume(progress, { ...catalog, get: () => null }), null);
});
test('invalid dates, catalogs and absent progress safely return null', () => {
  const { progress, catalog } = fixture();
  for (const p of [null, undefined, {}, { placements: null }, { placements: [] }]) assert.equal(resume(p, catalog), null);
  for (const today of ['', '2026-02-30', '2026-09-15', '2026-09-14']) assert.equal(resume(progress, catalog, today), null);
  for (const c of [null, {}, { ...catalog, dailyIds: [] }, { ...catalog, dailyIds: Array(14).fill(ids[0]) }, { ...catalog, dailyCycleAnchorDay: 'invalid' }]) assert.equal(resume(progress, c), null);
});
test('reads frozen input without changing stored progress, layouts or catalog data', () => {
  const { progress, catalog } = fixture();
  progress.placements[ids[0]] = snapshot('2026-09-15');
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  freeze(progress); ids.forEach(id => freeze(catalog.get(id)));
  const before = JSON.stringify(progress);
  assert.deepEqual(resume(progress, catalog), { levelId: ids[0], dayKey: '2026-09-15' });
  assert.equal(JSON.stringify(progress), before);
});
