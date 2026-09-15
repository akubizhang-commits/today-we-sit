'use strict';

const STORAGE_KEY = 'seating-progress';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function validPlacement(level, placement) {
  if (!record(placement)) return false;
  const people = new Set(level.people.map(p => p.id));
  const seats = new Set(level.seats.map(s => s.id));
  const used = new Set();
  for (const [person, seat] of Object.entries(placement)) {
    if (!people.has(person) || !seats.has(seat) || used.has(seat)) return false;
    used.add(seat);
  }
  return true;
}

function movePerson(level, placement, personId, seatIdOrNull) {
  if (!validPlacement(level, placement) || !level.people.some(p => p.id === personId)
      || (seatIdOrNull !== null && !level.seats.some(s => s.id === seatIdOrNull))) throw new Error('Invalid seating move');
  const next = { ...placement };
  if (seatIdOrNull === null) { delete next[personId]; return next; }
  const occupant = Object.keys(placement).find(id => id !== personId && placement[id] === seatIdOrNull);
  if (occupant) {
    if (own(placement, personId)) next[occupant] = placement[personId];
    else delete next[occupant];
  }
  Object.defineProperty(next, personId, { value: seatIdOrNull, enumerable: true, configurable: true, writable: true });
  return next;
}

function createSession(level, placement = {}) {
  if (!validPlacement(level, placement)) throw new Error('Invalid placement');
  return { placement: { ...placement }, history: [] };
}

function transition(session, placement) {
  const keys = Object.keys(session.placement);
  const same = keys.length === Object.keys(placement).length && keys.every(id => session.placement[id] === placement[id]);
  return { placement: { ...placement }, history: same ? session.history.map(p => ({ ...p }))
    : [...session.history.map(p => ({ ...p })), { ...session.placement }] };
}

function applyMove(level, session, personId, seatId) {
  return transition(session, movePerson(level, session.placement, personId, seatId));
}

function undo(session) {
  if (!session.history.length) return transition(session, session.placement);
  return { placement: { ...session.history[session.history.length - 1] }, history: session.history.slice(0, -1).map(p => ({ ...p })) };
}

function reset(session) { return transition(session, {}); }

function loadProgress(storage, levels) {
  const fresh = () => ({ version: 1, currentLevel: levels.length ? levels[0].id : 1, completed: [], placements: {} });
  try {
    let raw = storage.get(STORAGE_KEY);
    if (typeof raw === 'string') raw = JSON.parse(raw);
    if (!record(raw) || raw.version !== 1) return fresh();
    const progress = fresh();
    const source = record(raw.placements) ? raw.placements : {};
    for (const level of levels) {
      if (!own(source, level.id) || !record(source[level.id])) continue;
      const clean = {};
      const used = new Set();
      const seats = new Set(level.seats.map(s => s.id));
      for (const person of level.people) {
        if (!own(source[level.id], person.id)) continue;
        const seat = source[level.id][person.id];
        if (!seats.has(seat) || used.has(seat)) continue;
        Object.defineProperty(clean, person.id, { value: seat, enumerable: true });
        used.add(seat);
      }
      Object.defineProperty(progress.placements, level.id, { value: clean, enumerable: true, writable: true, configurable: true });
    }
    const claimed = new Set(Array.isArray(raw.completed) ? raw.completed : []);
    for (const level of levels) {
      // Completion is historical; an unfinished replay can replace its layout.
      // Only the contiguous prefix of known level IDs unlocks further levels.
      if (!claimed.has(level.id)) break;
      progress.completed.push(level.id);
    }
    const unlocked = levels.slice(0, Math.min(progress.completed.length + 1, levels.length));
    progress.currentLevel = unlocked.some(level => level.id === raw.currentLevel) ? raw.currentLevel
      : unlocked.length ? unlocked[unlocked.length - 1].id : progress.currentLevel;
    return progress;
  } catch (_) { return fresh(); }
}

function saveProgress(storage, progress) {
  try {
    if (!record(progress) || progress.version !== 1 || !Array.isArray(progress.completed) || !record(progress.placements)) return false;
    // Detach the saved snapshot even when an adapter stores objects by reference.
    const snapshot = JSON.parse(JSON.stringify(progress));
    return storage.set(STORAGE_KEY, snapshot) !== false;
  } catch (_) { return false; }
}

module.exports = { movePerson, createSession, applyMove, undo, reset, loadProgress, saveProgress };
