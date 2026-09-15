'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loadModule = name => {
  const file = path.join(__dirname, '../src/progress', name + '.js');
  return fs.existsSync(file) ? require(file) : {};
};
const { createProgress, validateProgress } = loadModule('schema');
const { migrateV1 } = loadModule('migrate');

// Independent catalog double: intentionally exposes only the documented contract.
function fixtureCatalog({ expanded = true, revision = 1 } = {}) {
  const levels = [];
  const chapters = ['bus', 'garden', 'cinema'].map(id => {
    const levelIds = Array.from({ length: expanded ? 30 : 10 }, (_, i) => `${id}-${String(i + 1).padStart(3, '0')}`);
    for (const levelId of levelIds) levels.push({ id: levelId, chapterId: id, revision,
      people: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], seats: [{ id: 's1' }, { id: 's2' }, { id: 's4' }] });
    return { id, levelIds };
  });
  levels.push({ id: 'daily-001', revision, people: [{ id: 'p1' }], seats: [{ id: 's1' }] });
  const campaignIds = chapters.flatMap(c => c.levelIds);
  return { contentVersion: '1.0.0', campaignIds, dailyIds: ['daily-001'], chapters,
    get: id => levels.find(l => l.id === id),
    next: id => campaignIds[campaignIds.indexOf(id) + 1] || null,
    displayNumber: id => campaignIds.indexOf(id) + 1 };
}
const catalog = fixtureCatalog();
const legacy = name => require(`./fixtures/legacy-${name}.json`);

test('progress modules expose the requested APIs', () => {
  assert.equal(typeof createProgress, 'function');
  assert.equal(typeof validateProgress, 'function');
  assert.equal(typeof migrateV1, 'function');
});
test('fresh schema has independent safe domain defaults and first chapter', () => {
  const p = createProgress(catalog);
  assert.equal(p.version, 2);
  assert.equal(p.currentLevelId, 'bus-001');
  assert.deepEqual(p.chapterAccess, ['bus']);
  assert.equal(p.sync.enabled, false);
  assert.deepEqual(p.hintAccess.grants, []);
  p.tutorial.completedSteps.push('select');
  assert.deepEqual(createProgress(catalog).tutorial.completedSteps, []);
  assert.equal(validateProgress(p, catalog).ok, true);
});
test('legacy twelve maps old 13 to garden and retains a compatible placement wrapper', () => {
  const input = structuredClone(legacy('twelve'));
  const { progress: p } = migrateV1(input, catalog);
  assert.equal(p.currentLevelId, 'garden-003');
  assert.deepEqual(p.completed.slice(-2), ['garden-001', 'garden-002']);
  assert.equal(p.completed.includes('bus-011'), false);
  assert.deepEqual(p.chapterAccess, ['bus', 'garden']);
  assert.deepEqual(p.placements['garden-003'].placement, { p1: 's4' });
  assert.equal(p.placements['garden-003'].contentRevision, 1);
  assert.equal(typeof p.placements['garden-003'].sessionId, 'string');
  assert.equal(p.placements['garden-003'].moveSequence, 0);
  assert.deepEqual(input, legacy('twelve'));
});
test('new, ten and all thirty migration preserve old unlocked chapter boundaries', () => {
  assert.deepEqual(migrateV1(legacy('new'), catalog).progress.completed, []);
  assert.deepEqual(migrateV1(legacy('ten'), catalog).progress.chapterAccess, ['bus', 'garden']);
  const p = migrateV1(legacy('all'), catalog).progress;
  assert.equal(p.completed.length, 30);
  assert.equal(p.currentLevelId, 'cinema-010');
  assert.deepEqual(p.chapterAccess, ['bus', 'garden', 'cinema']);
});
test('migration filters unknown IDs and cleans duplicates without discarding good seats', () => {
  const { progress: p, warnings } = migrateV1(legacy('corrupt'), catalog);
  assert.deepEqual(p.completed, ['bus-001', 'garden-001']);
  assert.deepEqual(p.placements['garden-003'].placement, { p1: 's4' });
  assert.equal(p.placements['999'], undefined);
  assert.ok(warnings.length > 0);
});
test('explicit legacyId overrides fallback mapping without relying on manifest order', () => {
  const c = fixtureCatalog({ expanded: false });
  c.get('garden-003').legacyId = 12;
  c.get('garden-002').legacyId = 13;
  c.campaignIds.reverse();
  assert.equal(migrateV1(legacy('twelve'), c).progress.currentLevelId, 'garden-002');
});
test('revision change resets only incompatible old board and explains it', () => {
  const c = fixtureCatalog({ revision: 2 });
  c.get('garden-003').seats = [{ id: 'different-seat' }];
  const { progress: p, warnings } = migrateV1(legacy('twelve'), c);
  assert.equal(p.completed.length, 12);
  assert.equal(p.placements['garden-003'], undefined);
  assert.ok(warnings.some(w => w.includes('garden-003')));
  const compatible = migrateV1(legacy('twelve'), fixtureCatalog({ revision: 2 })).progress;
  assert.deepEqual(compatible.placements['garden-003'].placement, { p1: 's4' });
  assert.equal(compatible.placements['garden-003'].contentRevision, 2);
});
test('v2 migration is idempotent, preserves noncontiguous completion and extra domain fields', () => {
  const p = createProgress(catalog);
  p.completed = ['bus-001', 'garden-002', 'cinema-009'];
  p.settings.captionSize = 'large';
  p.tutorial.currentStep = { levelId: 'bus-001', step: 'place' };
  p.daily.cached = { '2026-09-15': { levelId: 'daily-001' } };
  p.album.lastViewedId = 'card-5';
  p.hintAccess.receipts = { r1: { placement: { p1: 's1' } } };
  assert.deepEqual(migrateV1(p, catalog).progress, p);
  const checked = validateProgress(p, catalog);
  assert.equal(checked.ok, true);
  assert.deepEqual(checked.value, p);
  checked.value.settings.captionSize = 'small';
  assert.equal(p.settings.captionSize, 'large');
});
test('schema rejects malformed shape, future versions, invalid domain values and unsafe JSON', () => {
  for (const patch of [{ version: 3 }, { completed: 'all' }, { placements: [] }, { localRevision: -1 },
    { settings: { music: 'yes' } }, { tutorial: { completedSteps: 'all' } },
    { hintAccess: { grants: [], consumedIds: [], fallbackClaimed: [], invalid: Infinity } }]) {
    assert.equal(validateProgress({ ...createProgress(catalog), ...patch }, catalog).ok, false);
  }
  const cyclic = createProgress(catalog); cyclic.daily.loop = cyclic;
  assert.equal(validateProgress(cyclic, catalog).ok, false);
  assert.throws(() => migrateV1({ version: 3 }, catalog), /version|schema/i);
});
test('v2 validation filters unknown completion IDs without imposing a prefix', () => {
  const p = createProgress(catalog);
  p.completed = ['garden-002', 'bus-001', 'garden-002', 'unknown', 'daily-001'];
  const result = validateProgress(p, catalog);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.completed, ['bus-001', 'garden-002']);
});
module.exports = { fixtureCatalog };

test('the real catalog adapter migrates the reviewed old-13 fixture without invented references', () => {
  const { catalog: actual } = require('../src/content/current');
  const { progress: p } = migrateV1(legacy('twelve'), actual);
  assert.equal(p.currentLevelId, 'garden-003');
  assert.ok(actual.get('garden-003').people.some(person => person.id === 'p1'));
  assert.ok(actual.get('garden-003').seats.some(seat => seat.id === 's4'));
  assert.deepEqual(p.placements['garden-003'].placement, { p1: 's4' });
});
