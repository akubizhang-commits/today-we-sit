'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const read = () => clone({ levels: require('../content/authoring/levels.json'), manifest: require('../content/manifest.json') });
const validate = (...args) => require('../scripts/validate-content').validateContent(...args);

test('release authoring and tools exist', () => {
  for (const file of ['content/authoring/levels.json', 'content/manifest.json', 'scripts/validate-content.js', 'scripts/build-content.js']) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing release deliverable: ${file}`);
  }
});
test('release contains 90 campaign, 14 independent daily and 20 reserve puzzles', () => {
  const { levels, manifest } = read();
  const result = validate(levels, manifest, { release: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.report.counts, { campaign: 90, daily: 14, reserve: 20 });
  assert.deepEqual(result.report.difficulty, { easy: 36, normal: 40, challenge: 14 });
  assert.equal(result.report.levels.length, 124);
  assert.equal(result.report.manualPhoneQA, 'pending');
  assert.ok(result.report.levels.every(l => l.solutionCount >= 1 && l.searchStatus !== 'budgetExceeded'));
  assert.equal(manifest.dailyCycleAnchorDay, '2026-09-15');
});
test('all legacy geometry, person identities, rules and reference placements are unchanged', () => {
  const { levels } = read();
  for (const old of require('../src/content/levels').levels) {
    const chapter = ['bus', 'garden', 'cinema'][old.chapter];
    const level = levels.find(l => l.id === `${chapter}-${String((old.id - 1) % 10 + 1).padStart(3, '0')}`);
    for (const key of ['chapter', 'title', 'intro', 'seats', 'adjacency', 'people', 'reference']) assert.deepEqual(level[key], old[key], `${level.id}.${key}`);
  }
});
test('real engine solves every puzzle and a finite forward hint path completes it', { timeout: 60000 }, () => {
  const engine = require('../src/core/engine');
  for (const level of read().levels) {
    assert.equal(engine.evaluate(level, level.reference).complete, true, level.id);
    const solution = engine.solve(level);
    assert.ok(solution, level.id);
    assert.equal(engine.evaluate(level, solution).complete, true, level.id);
    const placement = {};
    const seen = new Set();
    for (let step = 0; step < level.people.length && !engine.evaluate(level, placement).complete; step++) {
      const hint = engine.getHint(level, placement);
      assert.ok(hint && hint.seatId, `${level.id}: forward hint`);
      assert.ok(!Object.values(placement).includes(hint.seatId));
      placement[hint.personId] = hint.seatId;
      const key = JSON.stringify(placement);
      assert.ok(!seen.has(key), `${level.id}: repeated hint`);
      seen.add(key);
    }
    assert.equal(engine.evaluate(level, placement).complete, true, `${level.id}: hint path`);
  }
});
test('new puzzles reuse twelve consistent characters and vary layout and topology', () => {
  const levels = read().levels.filter(l => !(l.kind === 'campaign' && Number(l.id.slice(-3)) <= 10));
  assert.equal(levels.length, 94);
  const cast = new Map();
  for (const l of levels) for (const p of l.people) {
    if (cast.has(p.id)) assert.equal(cast.get(p.id), p.name);
    cast.set(p.id, p.name);
  }
  assert.equal(cast.size, 12);
  assert.ok(new Set(levels.map(l => JSON.stringify(l.seats.map(s => [s.x, s.y])))).size >= 8);
  const signatures = levels.map(require('../scripts/validate-content').structuralSignature);
  assert.equal(new Set(signatures).size, 94);
});
test('invalid inputs produce diagnostics, never a successful validation or exception', () => {
  const { levels, manifest } = read();
  const cases = [
    [l => { l[0].people[0].rules[0] = { type: 'adjacent', person: 'missing', text: 'missing' }; }, 'rule-reference'],
    [l => { l[0].reference = {}; }, 'reference'],
    [l => { l[0].people[0].rules.push({ type: 'notTag', value: 'window', text: '不靠窗' }); }, 'unsolvable'],
    [l => { l[0].adjacency = []; }, 'adjacency'],
    [l => { l[0].seats[0].tags = ['unknown']; }, 'tag'],
    [l => { l[0].people = Array(9).fill(l[0].people[0]); }, 'people'],
    [l => { l[0].revision = 0; }, 'revision'],
    [l => { l[0].designIntent = ''; }, 'metadata'],
    [l => { l[0] = null; }, 'schema']
  ];
  for (const [mutate, code] of cases) {
    const data = clone(levels.slice(0, 1)); mutate(data);
    const result = validate(data, { ...manifest, campaign: ['bus-001'], daily: [], reserve: [] });
    assert.equal(result.ok, false, code);
    assert.ok(result.errors.some(e => e.code === code), `${code}: ${JSON.stringify(result.errors)}`);
  }
  for (const bad of [null, {}, [null]]) assert.equal(validate(bad, null).ok, false);
});
test('release gate rejects missing counts, wrong membership, malformed date and duplicate IDs', () => {
  const { levels, manifest } = read();
  for (const mutate of [m => m.campaign.pop(), m => m.daily.push(m.campaign[0]), m => m.dailyCycleAnchorDay = '2026-02-30', m => m.chapters[0].id = 'unknown']) {
    const m = clone(manifest); mutate(m);
    assert.equal(validate(levels, m, { release: true }).ok, false);
  }
});
test('structural duplicates are rejected even after renaming/reordering people, seats and prose', () => {
  const { levels, manifest } = read();
  const a = clone(levels.find(l => l.id === 'garden-014'));
  const b = clone(a); b.id = 'daily-099'; b.kind = 'daily'; b.title = '另一名字';
  const personMap = Object.fromEntries(b.people.map((p, i) => [p.id, `other${i}`]));
  const seatMap = Object.fromEntries(b.seats.map((s, i) => [s.id, `chair${i}`]));
  b.people.forEach(p => { p.id = personMap[p.id]; p.name += '改'; p.rules.reverse().forEach(r => { if (r.person) r.person = personMap[r.person]; r.text = '改'; }); });
  b.people.reverse(); b.seats.forEach(s => { s.id = seatMap[s.id]; s.tags.reverse(); }); b.seats.reverse();
  b.adjacency = b.adjacency.reverse().map(e => e.map(id => seatMap[id]).reverse());
  b.reference = Object.fromEntries(Object.entries(b.reference).map(([p, s]) => [personMap[p], seatMap[s]]));
  const result = validate([a, b], { ...manifest, campaign: [a.id], daily: [b.id], reserve: [] });
  assert.ok(result.errors.some(e => e.code === 'structural-duplicate'), JSON.stringify(result.errors));
});
test('bounded search reports incomplete counting honestly', () => {
  const { levels, manifest } = read();
  const level = levels[1];
  const result = validate([level], { ...manifest, campaign: [level.id], daily: [], reserve: [] }, { nodeBudget: 1 });
  assert.ok(result.errors.some(e => e.code === 'search-budget'));
  assert.equal(result.report.levels[0].searchStatus, 'budgetExceeded');
});
test('build writes deterministic CommonJS published content only and rejects invalid source before writing', () => {
  const { buildContent } = require('../scripts/build-content');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-content-'));
  try {
    fs.mkdirSync(path.join(tmp, 'content/authoring'), { recursive: true });
    const { levels, manifest } = read();
    fs.writeFileSync(path.join(tmp, 'content/authoring/levels.json'), JSON.stringify(levels));
    fs.writeFileSync(path.join(tmp, 'content/manifest.json'), JSON.stringify(manifest));
    const output = buildContent({ root: tmp, mode: 'production' });
    assert.equal(output.levelCount, 104);
    const runtime = path.join(tmp, 'src/content/runtime');
    const text = fs.readFileSync(path.join(runtime, 'levels.js'), 'utf8');
    assert.equal(require(path.join(runtime, 'levels.js')).levels.length, 104);
    assert.deepEqual(require(path.join(runtime, 'manifest.js')).campaign, manifest.campaign);
    const combined = text + fs.readFileSync(path.join(runtime, 'manifest.js'), 'utf8');
    assert.doesNotMatch(combined, /reference|designIntent|reserve|manualPhoneQA/);
    buildContent({ root: tmp, mode: 'production' });
    assert.equal(fs.readFileSync(path.join(runtime, 'levels.js'), 'utf8'), text);
    levels[0].reference = {};
    fs.writeFileSync(path.join(tmp, 'content/authoring/levels.json'), JSON.stringify(levels));
    assert.throws(() => buildContent({ root: tmp, mode: 'production' }), /validation/i);
    assert.equal(fs.readFileSync(path.join(runtime, 'levels.js'), 'utf8'), text);
    assert.throws(() => buildContent({ root: tmp, mode: 'typo' }), /mode/i);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test('validation CLI succeeds on release and fails for invalid source', () => {
  const good = spawnSync(process.execPath, [path.join(root, 'scripts/validate-content.js'), '--release'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.equal(JSON.parse(good.stdout).ok, true);
  const bad = spawnSync(process.execPath, [path.join(root, 'scripts/validate-content.js'), '--root', '/nonexistent-content-root', '--release'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
});

test('development can validate a small catalog; production cannot bypass the release gate', () => {
  const { levels, manifest } = read();
  const small = { ...manifest, campaign: [levels[0].id], daily: [], reserve: [] };
  assert.equal(validate([levels[0]], small).ok, true);
  assert.equal(validate([levels[0]], small, { release: true }).ok, false);
});
test('CLI rejects unknown flags instead of silently running in development mode', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate-content.js'), '--relase'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
});
