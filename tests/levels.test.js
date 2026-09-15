'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const contentPath = path.join(__dirname, '../src/content/levels.js');
const enginePath = path.join(__dirname, '../src/core/engine.js');
const content = fs.existsSync(contentPath) ? require(contentPath) : { levels: [], chapters: [] };
const { levels, chapters } = content;
// An absent parallel-worker dependency is explicit; an existing but broken engine must fail.
const engine = fs.existsSync(enginePath) ? require('../src/core/engine') : null;
const integration = { skip: engine ? false : 'src/core/engine.js not available yet' };
const ruleTypes = new Set(['tag', 'notTag', 'zone', 'adjacent', 'apart', 'emptyNeighbor']);

test('content exports exactly 30 ordered levels across three ten-level chapters', () => {
  assert.equal(levels.length, 30);
  assert.deepEqual(chapters.map(chapter => chapter.id), [0, 1, 2]);
  assert.deepEqual(levels.map(level => level.id), Array.from({ length: 30 }, (_, i) => i + 1));
  for (const chapter of chapters) {
    for (const key of ['title', 'subtitle', 'color']) assert.ok(chapter[key]?.trim(), key);
    assert.match(chapter.color, /^#[0-9a-f]{6}$/i);
    assert.equal(levels.filter(level => level.chapter === chapter.id).length, 10);
  }
  assert.equal(new Set(levels.map(level => level.title)).size, 30);
});

test('layouts, references and rule targets obey the renderer and engine contracts', () => {
  assert.equal(levels.length, 30);
  const usedTypes = new Set();
  for (const level of levels) {
    const label = `level ${level.id}`;
    assert.equal(level.chapter, Math.floor((level.id - 1) / 10), label);
    assert.ok(level.title.trim() && level.intro.trim(), label);
    assert.ok(level.people.length >= 1 && level.people.length <= 8, label);
    assert.ok(level.seats.length >= level.people.length && level.seats.length <= 12, label);
    const seats = new Map(level.seats.map(seat => [seat.id, seat]));
    const people = new Map(level.people.map(person => [person.id, person]));
    assert.equal(seats.size, level.seats.length, label);
    assert.equal(people.size, level.people.length, label);
    assert.equal(new Set(level.seats.map(seat => `${seat.x},${seat.y}`)).size, seats.size, label);
    for (const seat of level.seats) {
      assert.equal(typeof seat.id, 'string', label);
      assert.ok(Number.isInteger(seat.x) && seat.x >= 0 && seat.x < 4, label);
      assert.ok(Number.isInteger(seat.y) && seat.y >= 0 && seat.y < 3, label);
      assert.ok(Array.isArray(seat.tags) && seat.tags.length, label);
      assert.equal(new Set(seat.tags).size, seat.tags.length, label);
      assert.ok(seat.tags.some(tag => /^row[1-3]$/.test(tag)), `${label}: row label`);
      assert.ok(seat.tags.some(tag => ['left', 'center', 'right'].includes(tag)), `${label}: side label`);
      assert.ok(typeof seat.zone === 'string' && seat.zone.length, label);
      if (level.chapter === 0 && seat.x === 0) assert.ok(seat.tags.includes('window'), label);
      if (level.chapter === 0 && seat.y === 0 && seat.x === 1) assert.ok(seat.tags.includes('door'), label);
    }
    const edges = new Set();
    for (const edge of level.adjacency) {
      assert.equal(edge.length, 2, label);
      const [a, b] = edge.map(id => seats.get(id));
      assert.ok(a && b && a !== b, label);
      assert.equal(a.y, b.y, `${label}: no vertical adjacency`);
      assert.equal(Math.abs(a.x - b.x), 1, `${label}: no skipped seats`);
      const key = [...edge].sort().join(':');
      assert.ok(!edges.has(key), `${label}: duplicate edge`);
      edges.add(key);
    }
    for (const a of level.seats) {
      for (const b of level.seats) {
        if (a.y === b.y && Math.abs(a.x - b.x) === 1) {
          assert.ok(edges.has([a.id, b.id].sort().join(':')), `${label}: missing horizontal edge`);
        }
      }
    }
    assert.deepEqual(Object.keys(level.reference).sort(), [...people.keys()].sort(), label);
    assert.equal(new Set(Object.values(level.reference)).size, people.size, label);
    for (const seatId of Object.values(level.reference)) assert.ok(seats.has(seatId), label);
    for (const person of level.people) {
      assert.ok(person.id && person.name.trim(), label);
      assert.match(person.color, /^#[0-9a-f]{6}$/i, label);
      assert.ok(person.rules.length > 0, label);
      for (const rule of person.rules) {
        assert.ok(ruleTypes.has(rule.type), label);
        usedTypes.add(rule.type);
        assert.ok(typeof rule.text === 'string' && rule.text.trim(), label);
        if (['adjacent', 'apart'].includes(rule.type)) {
          assert.ok(people.has(rule.person) && rule.person !== person.id, label);
          assert.ok(rule.text.includes(people.get(rule.person).name), `${label}: readable relationship`);
        } else if (rule.type === 'zone') {
          assert.ok(level.seats.some(seat => seat.zone === rule.value), label);
        } else if (['tag', 'notTag'].includes(rule.type)) {
          assert.ok(level.seats.some(seat => seat.tags.includes(rule.value)), label);
        }
        if (rule.type === 'emptyNeighbor') assert.ok(seats.size > people.size, label);
      }
    }
  }
  assert.deepEqual([...usedTypes].sort(), [...ruleTypes].sort());
});

test('first three tutorials stay small; later levels are not renamed copies', () => {
  assert.equal(levels.length, 30);
  for (const level of levels.slice(0, 3)) {
    assert.ok(level.people.length <= 2);
    assert.ok(level.people.every(person => person.rules.length === 1));
  }
  // Ignore prose, colors and reference placements: these cannot disguise copied puzzles.
  const signatures = levels.map(level => JSON.stringify({
    seats: level.seats.map(({ x, y, tags, zone }) => ({ x, y, tags, zone })),
    rules: level.people.map(person => person.rules.map(({ type, value, person: target }) => ({
      type, value, target: target ? level.people.findIndex(p => p.id === target) : undefined
    })))
  }));
  assert.equal(new Set(signatures).size, 30);
});

for (let id = 1; id <= 30; id++) {
  test(`level ${id}: reference satisfies every rule and solver finds a legal placement`, integration, () => {
    const level = levels.find(candidate => candidate.id === id);
    assert.ok(level, `missing level ${id}`);
    const referenceResult = engine.evaluate(level, level.reference);
    assert.equal(referenceResult.complete, true, JSON.stringify(referenceResult));
    assert.equal(referenceResult.satisfied, referenceResult.total);
    const result = engine.solve(level);
    assert.ok(result, `level ${id} has no solution`);
    assert.equal(engine.evaluate(level, result).complete, true);
    assert.deepEqual(engine.solve(level, level.reference), level.reference);
  });
}

test('at least one tutorial has exactly one solution', integration, () => {
  // Enumerate these tiny boards independently of the solver's search order.
  const counts = levels.slice(0, 3).map(level => {
    let count = 0;
    function visit(index, placement, occupied) {
      if (index === level.people.length) {
        if (engine.evaluate(level, placement).complete) count++;
        return;
      }
      const id = level.people[index].id;
      for (const seat of level.seats) {
        if (occupied.has(seat.id)) continue;
        occupied.add(seat.id);
        placement[id] = seat.id;
        visit(index + 1, placement, occupied);
        occupied.delete(seat.id);
        delete placement[id];
      }
    }
    visit(0, {}, new Set());
    return count;
  });
  assert.ok(counts.some(count => count === 1), `tutorial solution counts: ${counts}`);
});

test('a non-reference solution can complete a deliberately open tutorial', integration, () => {
  const level = levels[2];
  const alternative = Object.fromEntries(level.people.map((person, i) => [
    person.id, level.reference[level.people[1 - i].id]
  ]));
  assert.notDeepEqual(alternative, level.reference);
  assert.equal(engine.evaluate(level, alternative).complete, true);
});
