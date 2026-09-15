'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getAdvancedHint } = require('../src/core/hints');
const { evaluate } = require('../src/core/engine');
const { createSession, applyMove } = require('../src/core/session');

const fast = { yieldControl: async () => {} };
const flexible = {
  seats: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  adjacency: [],
  people: [{ id: 'a', name: '阿安' }, { id: 'b', name: '小白' }]
};
const assigned = {
  seats: ['a', 'b', 'c'].map(id => ({ id: `s${id}`, tags: [id] })),
  adjacency: [],
  people: ['a', 'b', 'c'].map(id => ({
    id, name: id, rules: [{ type: 'tag', value: id, text: `需要${id}座位` }]
  }))
};

async function finish(level, placement, bound = 16) {
  let session = createSession(level, placement);
  const seen = new Set();
  for (let step = 0; step <= bound; step++) {
    const key = JSON.stringify(Object.entries(session.placement).sort());
    assert.ok(!seen.has(key), `hint cycle: ${key}`);
    seen.add(key);
    const result = await getAdvancedHint(level, session.placement, fast);
    if (result.status === 'complete') {
      assert.equal(evaluate(level, session.placement).complete, true);
      return session;
    }
    assert.equal(result.status, 'ready');
    assert.deepEqual(Object.keys(result.hint).sort(), ['personId', 'seatId', 'text']);
    session = applyMove(level, session, result.hint.personId, result.hint.seatId);
  }
  assert.fail('hints did not complete within the move bound');
}

test('exports an async hint API and preserves compatible alternate arrangements', async () => {
  const placement = { b: 's1' };
  const pending = getAdvancedHint(flexible, placement, fast);
  assert.ok(pending instanceof Promise);
  const result = await pending;
  assert.equal(result.status, 'ready');
  assert.equal(result.hint.personId, 'a');
  assert.notEqual(result.hint.seatId, 's1');
  assert.match(result.hint.text, /一种可行安排/);
  assert.doesNotMatch(result.hint.text, /唯一|只能/);
  assert.deepEqual(placement, { b: 's1' });
  const session = await finish(flexible, placement);
  assert.equal(session.placement.b, 's1');
});

test('complete includes alternate solutions and never returns another move', async () => {
  assert.deepEqual(await getAdvancedHint(flexible, { a: 's3', b: 's1' }, fast),
    { status: 'complete' });
  assert.deepEqual(await getAdvancedHint({ seats: [], people: [] }, {}, fast),
    { status: 'complete' });
});

test('repairs a swap while preserving the largest compatible subset', async () => {
  const placement = { a: 'sb', b: 'sa', c: 'sc' };
  const result = await getAdvancedHint(assigned, placement, fast);
  assert.equal(result.status, 'ready');
  assert.notEqual(result.hint.seatId, null);
  assert.match(result.hint.text, /调整/);
  assert.match(result.hint.text, /交换/);
  const moved = applyMove(assigned, createSession(assigned, placement),
    result.hint.personId, result.hint.seatId);
  assert.deepEqual(moved.placement, { a: 'sa', b: 'sb', c: 'sc' });
});

test('incompatible cycles unseat with an explanation and eventually complete through session', async () => {
  const placement = { a: 'sb', b: 'sc', c: 'sa' };
  const first = await getAdvancedHint(assigned, placement, fast);
  assert.equal(first.status, 'ready');
  assert.equal(first.hint.seatId, null);
  assert.match(first.hint.text, /候场区/);
  assert.match(first.hint.text, /无法|不能/);
  assert.deepEqual((await finish(assigned, placement)).placement,
    { a: 'sa', b: 'sb', c: 'sc' });
  await finish(assigned, {});
});

test('every legitimate partial layout of the three-person fixture completes without cycling', async () => {
  // Enumerate legal inputs, not expected solutions: the hand-authored tags
  // require a->sa, b->sb, c->sc for every starting layout.
  async function visit(index, placement) {
    if (index === assigned.people.length) {
      assert.deepEqual((await finish(assigned, placement, 9)).placement,
        { a: 'sa', b: 'sb', c: 'sc' });
      return;
    }
    await visit(index + 1, placement);
    for (const seat of assigned.seats) {
      if (!Object.values(placement).includes(seat.id)) {
        await visit(index + 1, { ...placement, [assigned.people[index].id]: seat.id });
      }
    }
  }
  await visit(0, {});
});

test('eight-person hand-constrained fixture completes within the default budget', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const level = {
    seats: ids.map(id => ({ id: `s${id}`, tags: [id] })),
    people: ids.map(id => ({ id, rules: [{ type: 'tag', value: id }] })),
    adjacency: []
  };
  const session = await finish(level, { h: 'sh', d: 'sd' }, 8);
  assert.deepEqual(session.placement,
    { a: 'sa', b: 'sb', c: 'sc', d: 'sd', e: 'se', f: 'sf', g: 'sg', h: 'sh' });
});

test('invalid external placements return unsolvable without an illegal hint', async () => {
  for (const placement of [null, [], { ghost: 's1' }, { a: 'missing' }, { a: 's1', b: 's1' }]) {
    assert.deepEqual(await getAdvancedHint(flexible, placement, fast), { status: 'unsolvable' });
  }
  const duplicate = { ...flexible, people: [{ id: 'a' }, { id: 'a' }] };
  assert.deepEqual(await getAdvancedHint(duplicate, {}, fast), { status: 'unsolvable' });
});

test('evaluates tag, notTag, zone, directed relations and emptyNeighbor constraints', async () => {
  const level = {
    seats: [
      { id: 's1', tags: ['window'], zone: 'left' },
      { id: 's2', tags: [], zone: 'left' },
      { id: 's3', tags: [], zone: 'right' },
      { id: 's4', tags: [], zone: 'right' }
    ],
    adjacency: [['s1', 's2'], ['s2', 's3'], ['s3', 's4']],
    people: [
      { id: 'a', rules: [{ type: 'tag', value: 'window' }, { type: 'adjacent', person: 'b' }] },
      { id: 'b', rules: [{ type: 'notTag', value: 'window' }, { type: 'zone', value: 'left' },
        { type: 'emptyNeighbor' }] },
      { id: 'c', rules: [{ type: 'apart', person: 'b' }] }
    ]
  };
  assert.deepEqual((await finish(level, { c: 's4' })).placement, { a: 's1', b: 's2', c: 's4' });
});

// All eight people need an empty neighbor, but all eight seats must be occupied.
// Partial layouts remain locally plausible, so this exercises real search work.
const hard = {
  seats: Array.from({ length: 8 }, (_, i) => ({ id: `s${i}` })),
  adjacency: Array.from({ length: 8 }, (_, i) => [`s${i}`, `s${(i + 1) % 8}`]),
  people: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, rules: [{ type: 'emptyNeighbor' }] }))
};

test('zero and hard budgets return budgetExceeded; work yields at the requested cadence', async () => {
  let yields = 0;
  assert.deepEqual(await getAdvancedHint(hard, {}, { nodeBudget: 0, yieldEvery: 1,
    yieldControl: async () => { yields++; } }), { status: 'budgetExceeded' });
  assert.equal(yields, 0);
  assert.deepEqual(await getAdvancedHint(hard, {}, { nodeBudget: 73, yieldEvery: 7,
    yieldControl: async () => { yields++; } }), { status: 'budgetExceeded' });
  assert.equal(yields, 10);
});

test('budget is shared across preserved subsets and repair feasibility checks', async () => {
  let work = 0;
  const placement = { a: 'sb', b: 'sc', c: 'sa' };
  const full = await getAdvancedHint(assigned, placement, { yieldEvery: 1,
    yieldControl: async () => { work++; } });
  assert.equal(full.status, 'ready');
  assert.ok(work > 1);
  for (const nodeBudget of [1, Math.floor(work / 2), work - 1]) {
    let yielded = 0;
    assert.deepEqual(await getAdvancedHint(assigned, placement, { nodeBudget, yieldEvery: 1,
      yieldControl: async () => { yielded++; } }), { status: 'budgetExceeded' });
    assert.equal(yielded, nodeBudget);
  }
  assert.equal((await getAdvancedHint(assigned, placement, { ...fast, nodeBudget: work })).status, 'ready');
  let cancelled = false;
  let yielded = 0;
  assert.deepEqual(await getAdvancedHint(assigned, placement, { yieldEvery: 1,
    isCancelled: () => cancelled,
    yieldControl: async () => { cancelled = ++yielded === work; }
  }), { status: 'cancelled' });
  assert.equal(yielded, work);
});

test('exhaustive impossibility is unsolvable, including conflicting rules and too few seats', async () => {
  const impossible = { ...flexible, people: [
    { id: 'a', rules: [{ type: 'tag', value: 'absent' }] }
  ] };
  assert.deepEqual(await getAdvancedHint(impossible, {}, fast), { status: 'unsolvable' });
  assert.deepEqual(await getAdvancedHint({ ...flexible, seats: [] }, {}, fast),
    { status: 'unsolvable' });
});

test('cancels before work and immediately after an awaited yield, including last-work cancellation', async () => {
  let yields = 0;
  assert.deepEqual(await getAdvancedHint(hard, {}, { nodeBudget: 0,
    isCancelled: () => true, yieldControl: async () => { yields++; } }), { status: 'cancelled' });
  assert.equal(yields, 0);
  let cancelled = false;
  const pending = getAdvancedHint(hard, {}, { yieldEvery: 3,
    isCancelled: () => cancelled,
    yieldControl: async () => { yields++; await Promise.resolve(); cancelled = true; } });
  assert.deepEqual(await pending, { status: 'cancelled' });
  assert.equal(yields, 1);
  cancelled = false;
  assert.deepEqual(await getAdvancedHint(flexible, { a: 's1', b: 's2' }, {
    yieldEvery: 1, isCancelled: () => cancelled,
    yieldControl: async () => { cancelled = true; }
  }), { status: 'cancelled' });
});

test('default yielding lets a timer cancel hard search', async () => {
  let cancelled = false;
  const timer = setTimeout(() => { cancelled = true; }, 0);
  try {
    assert.deepEqual(await getAdvancedHint(hard, {}, { isCancelled: () => cancelled }),
      { status: 'cancelled' });
  } finally { clearTimeout(timer); }
});

test('awaits yieldControl and snapshots placement and level before yielding', async () => {
  const level = structuredClone(assigned);
  const placement = { c: 'sc' };
  let release;
  let entered;
  const paused = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let first = true;
  let settled = false;
  const pending = getAdvancedHint(level, placement, { yieldEvery: 1,
    yieldControl: () => {
      if (!first) return Promise.resolve();
      first = false;
      entered();
      return gate;
    }
  }).then(result => { settled = true; return result; });
  await paused;
  placement.c = 'sa';
  level.people[0].rules[0].value = 'missing';
  level.seats[0].tags.length = 0;
  await Promise.resolve();
  assert.equal(settled, false);
  release();
  const result = await pending;
  assert.equal(result.status, 'ready');
  assert.equal(result.hint.personId, 'a');
  assert.equal(result.hint.seatId, 'sa');
});

test('rejects unbounded/invalid options and propagates scheduler failures', async () => {
  for (const nodeBudget of [-1, 1.5, Infinity, NaN]) {
    await assert.rejects(getAdvancedHint(flexible, {}, { nodeBudget }), RangeError);
  }
  for (const yieldEvery of [0, -1, 1.5, Infinity, NaN]) {
    await assert.rejects(getAdvancedHint(flexible, {}, { yieldEvery }), RangeError);
  }
  const error = new Error('scheduler failed');
  await assert.rejects(getAdvancedHint(flexible, {}, { yieldEvery: 1,
    yieldControl: async () => { throw error; } }), error);
});
