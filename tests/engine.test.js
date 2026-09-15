'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, solve, getHint } = require('../src/core/engine');
const { movePerson } = require('../src/core/session');
function fixture(rules = [{ type: 'adjacent', person: 'b', text: '坐在乙旁边' }]) {
  return { id: 1, seats: [
    { id: 's1', tags: ['window'], zone: 'front' },
    { id: 's2', tags: [], zone: 'front' },
    { id: 's3', tags: ['window'], zone: 'back' }
  ], adjacency: [['s1', 's2']], people: [{ id: 'a', rules }, { id: 'b', rules: [] }], reference: { a: 's1', b: 's2' } };
}
test('evaluate returns dictionary, rule counts, pending and alternate valid solutions', () => {
  const l = fixture();
  assert.deepEqual(evaluate(l, { a: 's1' }), { complete: false, satisfied: 0, total: 1, people: {
    a: { status: 'pending', rules: [{ status: 'pending', text: '坐在乙旁边' }] }, b: { status: 'pending', rules: [] }
  } });
  assert.equal(evaluate(l, { a: 's1', b: 's3' }).people.a.status, 'conflict');
  assert.equal(evaluate(l, { a: 's1', b: 's2' }).complete, true);
  assert.equal(evaluate(l, { a: 's2', b: 's1' }).complete, true);
});
test('unary rules use seat metadata and adjacency is explicit and undirected', () => {
  for (const [rule, good, bad] of [
    [{ type: 'tag', value: 'window' }, 's1', 's2'],
    [{ type: 'notTag', value: 'window' }, 's2', 's1'],
    [{ type: 'zone', value: 'front' }, 's2', 's3']
  ]) {
    const l = fixture([rule]);
    assert.equal(evaluate(l, {}).people.a.rules[0].status, 'pending');
    assert.equal(evaluate(l, { a: good }).people.a.status, 'satisfied');
    assert.equal(evaluate(l, { a: bad }).people.a.status, 'conflict');
  }
  const l = fixture([{ type: 'apart', person: 'b' }]);
  assert.equal(evaluate(l, { a: 's2' }).people.a.status, 'pending');
  assert.equal(evaluate(l, { a: 's2', b: 's1' }).complete, false);
  assert.equal(evaluate(l, { a: 's2', b: 's3' }).complete, true);
});
test('emptyNeighbor stays pending until everyone sits and requires a graph neighbor', () => {
  const l = fixture([{ type: 'emptyNeighbor' }]);
  assert.equal(evaluate(l, { a: 's1' }).people.a.status, 'pending');
  assert.equal(evaluate(l, { a: 's1', b: 's3' }).complete, true);
  assert.equal(evaluate(l, { a: 's1', b: 's2' }).people.a.status, 'conflict');
  assert.equal(evaluate(l, { a: 's3', b: 's1' }).people.a.status, 'conflict');
});
test('duplicate, unknown, incomplete and malformed placements cannot complete', () => {
  const l = fixture([]);
  for (const p of [{ a: 's1', b: 's1' }, { a: 'bad', b: 's2' }, { a: 's1' },
    { a: 's1', b: 's2', ghost: 's3' }, null, [], { a: null, b: 's2' }]) {
    assert.equal(evaluate(l, p).complete, false);
  }
  assert.equal(evaluate(l, { a: 's1', b: 's1' }).people.a.status, 'conflict');
  assert.equal(evaluate(l, { a: 's1', b: 's1' }).people.b.status, 'conflict');
});
test('solver preserves fixed assignments, rejects invalid fixed inputs and impossible levels', () => {
  const l = fixture();
  assert.deepEqual(solve(l, { a: 's2' }), { a: 's2', b: 's1' });
  for (const p of [{ a: 's3' }, { a: 's1', b: 's1' }, { a: 'missing' }, { ghost: 's1' }, { a: null }, null, []]) {
    assert.equal(solve(l, p), null);
  }
  assert.equal(solve(fixture([{ type: 'tag', value: 'impossible' }])), null);
  assert.equal(solve(fixture([{ type: 'unsupported' }])), null);
  assert.equal(solve(fixture([{ type: 'adjacent', person: 'ghost' }])), null);
});
test('solver handles empty-neighbor pruning without rejecting partial solutions', () => {
  assert.deepEqual(solve(fixture([{ type: 'emptyNeighbor' }]), { a: 's1' }), { a: 's1', b: 's3' });
});
test('hint extends a compatible layout and returns null for complete or impossible levels', () => {
  const l = fixture();
  const p = { b: 's1' };
  const hint = getHint(l, p);
  assert.equal(hint.personId, 'a');
  assert.equal(hint.seatId, 's2');
  assert.ok(hint.text.length);
  assert.deepEqual(p, { b: 's1' });
  assert.equal(getHint(l, { a: 's2', b: 's1' }), null);
  assert.equal(getHint(fixture([{ type: 'tag', value: 'missing' }]), {}), null);
});
test('repair hints preserve the maximum compatible assignments and lead to a solvable layout', () => {
  const l = fixture();
  const p = { a: 's3', b: 's1' };
  const hint = getHint(l, p);
  assert.equal(hint.personId, 'a');
  assert.equal(hint.seatId, 's2');
  assert.match(hint.text, /调整|repair/i);
  assert.ok(solve(l, movePerson(l, p, hint.personId, hint.seatId)));
});
test('repair can unseat first when no single seating move yields an extendable layout', () => {
  const l = fixture([{ type: 'tag', value: 'window' }]);
  l.people[1].rules = [{ type: 'zone', value: 'back' }];
  const p = { a: 's2', b: 's1' };
  const h = getHint(l, p);
  assert.ok(h);
  assert.match(h.text, /调整|repair/i);
  assert.ok(h.seatId === null || l.seats.some(s => s.id === h.seatId));
  // Repeated repairs must terminate at a genuine solution.
  let current = p;
  for (let i = 0; i < 8 && !evaluate(l, current).complete; i++) {
    const hint = getHint(l, current);
    assert.ok(hint);
    current = movePerson(l, current, hint.personId, hint.seatId);
  }
  assert.equal(evaluate(l, current).complete, true);
});

test('hint text uses displayed seat numbers rather than internal ids, including occupied targets', () => {
  const l = fixture();
  l.people[0].name = '小禾';
  l.people[1].name = '阿青';
  l.seats = [l.seats[2], l.seats[0], l.seats[1]];
  const h = getHint(l, { b: 's1' });
  assert.equal(h.seatId, 's2');
  assert.match(h.text, /小禾/);
  assert.match(h.text, /3号座位/);
  assert.doesNotMatch(h.text, /s2/);
  l.people[0].rules = [{ type: 'tag', value: 'window' }];
  l.people[1].rules = [{ type: 'zone', value: 'back' }];
  const repair = getHint(l, { a: 's2', b: 's3' });
  assert.match(repair.text, /小禾.*2号座位/);
  const unseat = getHint(l, { a: 's2', b: 's1' });
  assert.equal(unseat.seatId, null);
  assert.match(unseat.text, /小禾.*候场区/);
  const occupied = getHint(l, { a: 's3', b: 's1' });
  assert.match(occupied.text, /号座位/);
  assert.match(occupied.text, /阿青|小禾/);
  assert.doesNotMatch(occupied.text, /s[123]/);
});
