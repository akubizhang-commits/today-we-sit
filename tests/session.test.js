'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { movePerson, createSession, applyMove, undo, reset, loadProgress, saveProgress } = require('../src/core/session');
const level = { id: 1, seats: [{ id: 's1', tags: ['window'] }, { id: 's2', tags: [] }, { id: 's3', tags: [] }], adjacency: [],
  people: [{ id: 'a', rules: [{ type: 'tag', value: 'window' }] }, { id: 'b', rules: [] }] };
const levels = [level, { ...level, id: 2 }, { ...level, id: 3 }];
const good = { a: 's1', b: 's2' };
function storage(value) { const data = new Map(); return { get: key => data.has(key) ? data.get(key) : value, set: (key, v) => data.set(key, v) }; }
test('move seats, swaps, displaces a seated person and unseats without mutation', () => {
  assert.deepEqual(movePerson(level, good, 'a', 's2'), { a: 's2', b: 's1' });
  assert.deepEqual(movePerson(level, { b: 's2' }, 'a', 's2'), { a: 's2' });
  assert.deepEqual(movePerson(level, good, 'a', null), { b: 's2' });
  assert.deepEqual(movePerson(level, {}, 'a', 's1'), { a: 's1' });
  assert.deepEqual(good, { a: 's1', b: 's2' });
  for (const args of [[good, 'ghost', 's1'], [good, 'a', 'bad'], [{ a: 's1', b: 's1' }, 'a', null], [null, 'a', 's1'], [good, 'a', undefined]]) {
    assert.throws(() => movePerson(level, ...args), Error);
  }
});
test('sessions snapshot moves; undo and reset are immutable and reset is undoable', () => {
  const input = { a: 's1' };
  const initial = createSession(level, input);
  input.a = 's2';
  assert.deepEqual(initial, { placement: { a: 's1' }, history: [] });
  const moved = applyMove(level, initial, 'b', 's2');
  assert.deepEqual(moved.placement, good);
  assert.deepEqual(undo(moved), initial);
  assert.deepEqual(undo(initial), initial);
  const cleared = reset(moved);
  assert.deepEqual(cleared.placement, {});
  assert.deepEqual(undo(cleared), moved);
  assert.deepEqual(initial.placement, { a: 's1' });
  assert.deepEqual(applyMove(level, moved, 'a', 's1'), moved);
  assert.deepEqual(reset(createSession(level)), createSession(level));
  assert.throws(() => createSession(level, { a: 'bogus' }), Error);
});
test('storage is optional, errors and corrupt/unsupported payloads fall back safely', () => {
  const empty = { version: 1, currentLevel: 1, completed: [], placements: {} };
  for (const s of [undefined, {}, { get() { throw Error('blocked'); } }, storage('{bad'), storage(null), storage([]), storage({ version: 2 })]) {
    assert.deepEqual(loadProgress(s, levels), empty);
  }
  assert.equal(saveProgress(undefined, empty), false);
  assert.equal(saveProgress({ set() { throw Error('quota'); } }, empty), false);
  assert.equal(saveProgress(storage(), null), false);
});
test('progress roundtrips and only valid contiguous completions unlock levels', () => {
  const s = storage();
  const progress = { version: 1, currentLevel: 2, completed: [1], placements: { 1: good, 2: { a: 's2' } } };
  assert.equal(saveProgress(s, progress), true);
  assert.deepEqual(loadProgress(s, levels), progress);
  const raw = { version: 1, currentLevel: 999, completed: [1, 3, 999], placements: { 1: good, 3: good, 999: good } };
  const loaded = loadProgress(storage(raw), levels);
  assert.deepEqual(loaded.completed, [1]);
  assert.equal(loaded.currentLevel, 2);
  assert.equal(loaded.placements[999], undefined);
  for (const placements of [{}, { 1: { a: 's2', b: 's3' } }, { 1: { a: 's1', b: 's1' } }]) {
    const p = loadProgress(storage({ version: 1, currentLevel: 3, completed: [1, 2], placements }), levels);
    assert.deepEqual(p.completed, [1, 2]);
    assert.equal(p.currentLevel, 3);
  }
});
test('loading sanitizes layouts independently of historical completions', () => {
  const raw = { version: 1, currentLevel: 1, completed: [1], placements: { 1: { a: 's1', b: 's2', ghost: 's3' }, 2: { a: 's1', b: 's1' }, 3: { a: 'unknown' } } };
  const p = loadProgress(storage(JSON.stringify(raw)), levels);
  assert.deepEqual(p.placements[1], good);
  assert.deepEqual(p.placements[2], { a: 's1' });
  assert.deepEqual(p.placements[3], {});
  assert.deepEqual(p.completed, [1]);
});
test('known ids, replay selection and final-level bounds are preserved', () => {
  const p = { version: 1, currentLevel: 3, completed: [3, 1, 2, 2], placements: { 1: good, 2: good, 3: good } };
  assert.deepEqual(loadProgress(storage(p), levels).completed, [1, 2, 3]);
  assert.equal(loadProgress(storage(p), levels).currentLevel, 3);
  p.currentLevel = 1;
  assert.equal(loadProgress(storage(p), levels).currentLevel, 1);
  p.completed = ['1', 2];
  assert.deepEqual(loadProgress(storage(p), levels).completed, []);
});

test('save/load preserves completed level and next unlock during an empty unfinished replay', () => {
  const s = storage();
  const replay = { version: 1, currentLevel: 1, completed: [1], placements: { 1: {} } };
  assert.equal(saveProgress(s, replay), true);
  assert.deepEqual(loadProgress(s, levels), replay);
  const next = { ...replay, currentLevel: 2 };
  assert.equal(saveProgress(s, next), true);
  assert.deepEqual(loadProgress(s, levels), next);
});
