'use strict';

const { evaluate } = require('./engine');
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Each generator yield precedes one work unit. The async driver owns the single
// budget, including failed subsets and speculative repair searches.
function* compute(level, placement) {
  yield;
  const people = new Set(level.people.map(person => person.id));
  const seats = new Set(level.seats.map(seat => seat.id));
  if (!record(placement) || people.size !== level.people.length || seats.size !== level.seats.length
      || Object.entries(placement).some(([id, seat]) => !people.has(id) || !seats.has(seat))
      || new Set(Object.values(placement)).size !== Object.keys(placement).length) {
    return { status: 'unsolvable' };
  }
  yield;
  if (evaluate(level, placement).complete) return { status: 'complete' };
  const neighbors = new Map(level.seats.map(seat => [seat.id, new Set()]));
  for (const [a, b] of level.adjacency || []) {
    if (a !== b && neighbors.has(a) && neighbors.has(b)) {
      neighbors.get(a).add(b);
      neighbors.get(b).add(a);
    }
  }

  function* solve(fixed) {
    const p = Object.assign(Object.create(null), fixed);
    const used = new Set(Object.values(p));

    function* compatible() {
      yield;
      const result = evaluate(level, p);
      if (Object.values(result.people).some(person => person.status === 'conflict')) return false;
      // An already occupied neighbor cannot become empty as this branch fills.
      return level.people.every(person => !own(p, person.id) || !(person.rules || []).some(rule =>
        rule.type === 'emptyNeighbor' && ![...neighbors.get(p[person.id])].some(seat => !used.has(seat))));
    }

    function* search() {
      yield;
      if (!(yield* compatible())) return null;
      const remaining = level.people.filter(person => !own(p, person.id));
      // compatible() evaluated the full layout, so pending rules cannot remain.
      if (!remaining.length) return { ...p };
      if (remaining.length > seats.size - used.size) return null;
      let chosen;
      let candidates;
      for (const person of remaining) {
        const options = [];
        for (const seat of level.seats) {
          yield;
          if (used.has(seat.id)) continue;
          p[person.id] = seat.id;
          used.add(seat.id);
          if (yield* compatible()) options.push(seat.id);
          used.delete(seat.id);
          delete p[person.id];
        }
        if (!options.length) return null;
        if (!candidates || options.length < candidates.length) {
          chosen = person.id;
          candidates = options;
        }
      }
      for (const seat of candidates) {
        yield;
        p[chosen] = seat;
        used.add(seat);
        const solution = yield* search();
        used.delete(seat);
        delete p[chosen];
        if (solution) return solution;
      }
      return null;
    }
    return yield* search();
  }

  let target = yield* solve(placement);
  const repair = !target;
  if (!target) {
    const entries = Object.entries(placement);
    function* subset(start, count, fixed) {
      yield;
      if (!count) return yield* solve(fixed);
      for (let i = start; i <= entries.length - count; i++) {
        yield;
        const [id, seat] = entries[i];
        const result = yield* subset(i + 1, count - 1, { ...fixed, [id]: seat });
        if (result) return result;
      }
      return null;
    }
    for (let count = entries.length - 1; count >= 0 && !target; count--) {
      target = yield* subset(0, count, {});
    }
  }
  if (!target) return { status: 'unsolvable' };

  const changes = level.people.filter(person => !own(placement, person.id) || placement[person.id] !== target[person.id]);
  for (const person of changes) {
    yield;
    const next = { ...placement, [person.id]: target[person.id] };
    const occupant = level.people.find(other =>
      other.id !== person.id && own(placement, other.id) && placement[other.id] === target[person.id]);
    if (occupant) {
      if (own(placement, person.id)) {
        Object.defineProperty(next, occupant.id, {
          value: placement[person.id], enumerable: true, configurable: true, writable: true
        });
      } else delete next[occupant.id];
    }
    // Compatible fixed layouts need no second search: target already extends
    // next. Repairs must certify the actual session swap/displacement result.
    if (!repair || (yield* solve(next))) {
      const action = occupant
        ? own(placement, person.id)
          ? `，与${occupant.name || occupant.id}交换座位`
          : `，让${occupant.name || occupant.id}回候场区`
        : '';
      return { status: 'ready', hint: {
        personId: person.id,
        seatId: target[person.id],
        text: `${repair ? '当前安排无法满足全部要求，需要调整。' : ''}一种可行安排：把${person.name || person.id}安排到${level.seats.findIndex(seat => seat.id === target[person.id]) + 1}号座位${action}。${repair ? '调整后可继续完成其余安排。' : '保留其他人当前的位置。'}`
      } };
    }
  }
  // No tested target move makes the layout extendable. A mismatch removal reduces
  // placed-count minus maximum-preservable-count, even if the next call picks
  // another optimal solution. Once extendable, every hint seats another person.
  const person = changes.find(person => own(placement, person.id));
  return { status: 'ready', hint: {
    personId: person.id, seatId: null,
    text: `当前安排无法满足全部要求，为尽量保留可兼容的位置，需要分步调整。先让${person.name || person.id}回候场区：其当前位置与一种可行安排不符；再继续提示调整其余位置。`
  } };
}

async function getAdvancedHint(level, placement, {
  nodeBudget = 60000,
  yieldEvery = 128,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
  isCancelled = () => false
} = {}) {
  if (!Number.isSafeInteger(nodeBudget) || nodeBudget < 0) throw new RangeError('nodeBudget must be a nonnegative safe integer');
  if (!Number.isSafeInteger(yieldEvery) || yieldEvery < 1) throw new RangeError('yieldEvery must be a positive safe integer');
  if (typeof yieldControl !== 'function' || typeof isCancelled !== 'function') throw new TypeError('Callbacks must be functions');
  if (isCancelled()) return { status: 'cancelled' };

  // Detach the fields used by evaluate and hint text before the first await.
  // The caller still cancels/discards a result when the active level changes.
  const snapshot = {
    people: level.people.map(person => ({ ...person, rules: (person.rules || []).map(rule => ({ ...rule })) })),
    seats: level.seats.map(seat => ({ ...seat, tags: [...(seat.tags || [])] })),
    adjacency: (level.adjacency || []).map(edge => [...edge])
  };
  const search = compute(snapshot, record(placement) ? { ...placement } : placement);
  let work = 0;
  try {
    let step = search.next();
    while (!step.done) {
      if (isCancelled()) return { status: 'cancelled' };
      if (work >= nodeBudget) return { status: 'budgetExceeded' };
      work++;
      if (work % yieldEvery === 0) {
        await yieldControl();
        if (isCancelled()) return { status: 'cancelled' };
      }
      step = search.next();
    }
    return isCancelled() ? { status: 'cancelled' } : step.value;
  } finally {
    search.return();
  }
}

module.exports = { getAdvancedHint };
