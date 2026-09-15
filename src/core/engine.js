'use strict';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function context(level) {
  const people = new Map(level.people.map(p => [p.id, p]));
  const seats = new Map(level.seats.map(s => [s.id, s]));
  const neighbors = new Map(level.seats.map(s => [s.id, new Set()]));
  for (const [a, b] of level.adjacency || []) {
    if (a !== b && neighbors.has(a) && neighbors.has(b)) {
      neighbors.get(a).add(b);
      neighbors.get(b).add(a);
    }
  }
  return { people, seats, neighbors };
}

function inspect(ctx, placement) {
  const invalid = new Set();
  const occupied = new Map();
  let valid = record(placement);
  if (valid) for (const [id, seat] of Object.entries(placement)) {
    if (!ctx.people.has(id) || !ctx.seats.has(seat)) { valid = false; invalid.add(id); continue; }
    if (occupied.has(seat)) {
      invalid.add(id);
      invalid.add(occupied.get(seat));
      valid = false;
    }
    occupied.set(seat, id);
  }
  return { valid, invalid, occupied };
}

function ruleStatus(ctx, p, id, rule, state, allSeated) {
  if (state.invalid.has(id)) return 'conflict';
  if (!own(p, id)) return 'pending';
  const seat = ctx.seats.get(p[id]);
  if (!seat) return 'conflict';
  let ok;
  switch (rule.type) {
    case 'tag': ok = (seat.tags || []).includes(rule.value); break;
    case 'notTag': ok = !(seat.tags || []).includes(rule.value); break;
    case 'zone': ok = seat.zone === rule.value; break;
    case 'adjacent':
    case 'apart':
      if (!ctx.people.has(rule.person) || rule.person === id || state.invalid.has(rule.person)) return 'conflict';
      if (!own(p, rule.person)) return 'pending';
      ok = ctx.neighbors.get(seat.id).has(p[rule.person]);
      if (rule.type === 'apart') ok = !ok;
      break;
    case 'emptyNeighbor':
      if (!allSeated) return 'pending';
      ok = [...ctx.neighbors.get(seat.id)].some(s => !state.occupied.has(s));
      break;
    default: return 'conflict';
  }
  return ok ? 'satisfied' : 'conflict';
}

function evaluateWith(ctx, level, placement) {
  const state = inspect(ctx, placement);
  const p = record(placement) ? placement : {};
  const allSeated = state.valid && level.people.every(person => own(p, person.id));
  const people = {};
  let satisfied = 0;
  let total = 0;
  for (const person of level.people) {
    const rules = (person.rules || []).map(rule => {
      const status = ruleStatus(ctx, p, person.id, rule, state, allSeated);
      total++;
      if (status === 'satisfied') satisfied++;
      return { status, text: rule.text || '' };
    });
    const status = state.invalid.has(person.id) || rules.some(r => r.status === 'conflict') ? 'conflict'
      : !own(p, person.id) || rules.some(r => r.status === 'pending') ? 'pending' : 'satisfied';
    Object.defineProperty(people, person.id, { value: { status, rules }, enumerable: true });
  }
  return { complete: allSeated && Object.values(people).every(p => p.status === 'satisfied'), satisfied, total, people };
}

function evaluate(level, placement) {
  return evaluateWith(context(level), level, placement);
}

function solve(level, fixed = {}) {
  const ctx = context(level);
  if (!inspect(ctx, fixed).valid || ctx.people.size !== level.people.length || ctx.seats.size !== level.seats.length) return null;
  const p = { ...fixed };
  const used = new Set(Object.values(p));
  function compatible() {
    const evaluation = evaluateWith(ctx, level, p);
    if (Object.values(evaluation.people).some(person => person.status === 'conflict')) return false;
    // Empty seats can only disappear as search adds people, so this prune is sound.
    return level.people.every(person => !own(p, person.id) || !(person.rules || []).some(rule =>
      rule.type === 'emptyNeighbor' && ![...ctx.neighbors.get(p[person.id])].some(seat => !used.has(seat))));
  }
  function search() {
    if (!compatible()) return null;
    const remaining = level.people.filter(person => !own(p, person.id));
    if (!remaining.length) return evaluateWith(ctx, level, p).complete ? { ...p } : null;
    let chosen;
    let candidates;
    for (const person of remaining) {
      const options = [];
      for (const seat of level.seats) {
        if (used.has(seat.id)) continue;
        Object.defineProperty(p, person.id, { value: seat.id, writable: true, configurable: true, enumerable: true });
        used.add(seat.id);
        if (compatible()) options.push(seat.id);
        used.delete(seat.id);
        delete p[person.id];
      }
      if (!options.length) return null;
      if (!candidates || options.length < candidates.length) { chosen = person.id; candidates = options; }
    }
    for (const seat of candidates) {
      Object.defineProperty(p, chosen, { value: seat, writable: true, configurable: true, enumerable: true });
      used.add(seat);
      const solution = search();
      used.delete(seat);
      delete p[chosen];
      if (solution) return solution;
    }
    return null;
  }
  return search();
}

function getHint(level, placement) {
  const ctx = context(level);
  // Invalid external layouts must be cleaned by the session/storage boundary first.
  if (!inspect(ctx, placement).valid || evaluateWith(ctx, level, placement).complete) return null;
  let target = solve(level, placement);
  const repair = !target;
  if (!target) {
    const entries = Object.entries(placement);
    // Largest satisfiable subset gives an exact maximum-retention solution (<=8 people).
    function subset(start, count, fixed) {
      if (!count) return solve(level, fixed);
      for (let i = start; i <= entries.length - count; i++) {
        const [id, seat] = entries[i];
        const result = subset(i + 1, count - 1, { ...fixed, [id]: seat });
        if (result) return result;
      }
      return null;
    }
    for (let count = entries.length - 1; count >= 0 && !target; count--) target = subset(0, count, {});
  }
  if (!target) return null;
  const changes = level.people.filter(person => placement[person.id] !== target[person.id]);
  // Prefer a seating/swap move that immediately leaves an extendable layout.
  for (const person of changes) {
    const next = { ...placement, [person.id]: target[person.id] };
    const occupant = level.people.find(other => other.id !== person.id && placement[other.id] === target[person.id]);
    if (occupant) {
      if (own(placement, person.id)) next[occupant.id] = placement[person.id];
      else delete next[occupant.id];
    }
    if (solve(level, next)) return {
      personId: person.id, seatId: target[person.id],
      text: `${repair ? '需要调整：' : ''}请把${person.name || person.id}安排到${level.seats.findIndex(seat => seat.id === target[person.id]) + 1}号座位${occupant ? `（${occupant.name || occupant.id}现在的位置）` : ''}。`
    };
  }
  // Multiple incompatible assignments may require several repairs. Remove one
  // mismatch, retaining all assignments shared with the chosen valid solution.
  const person = changes.find(person => own(placement, person.id));
  return person ? { personId: person.id, seatId: null,
    text: `需要分步调整：先让${person.name || person.id}回候场区，随后继续提示调整其余位置。` } : null;
}

module.exports = { evaluate, solve, getHint };
