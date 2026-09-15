'use strict';
const { createProgress, validateProgress } = require('./schema');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// These are historical identities, independent of the new campaign's order/length.
function legacyMapping(catalog) {
  const mapping = new Map();
  const explicit = new Set();
  for (const id of catalog.campaignIds) {
    const level = catalog.get(id);
    if (Number.isInteger(level.legacyId) && level.legacyId >= 1 && level.legacyId <= 30) {
      if (mapping.has(level.legacyId)) throw new Error(`Ambiguous legacyId ${level.legacyId}`);
      mapping.set(level.legacyId, id);
      explicit.add(id);
    }
  }
  for (let oldId = 1; oldId <= 30; oldId++) {
    const chapter = ['bus', 'garden', 'cinema'][Math.floor((oldId - 1) / 10)];
    const id = `${chapter}-${String((oldId - 1) % 10 + 1).padStart(3, '0')}`;
    if (!mapping.has(oldId) && catalog.campaignIds.includes(id) && !explicit.has(id)) mapping.set(oldId, id);
  }
  return mapping;
}

/** Pure migration. Unsupported versions throw; repository preserves their bytes and blocks writes. */
function migrateV1(raw, catalog) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  if (record(raw) && raw.version === 2) {
    const result = validateProgress(raw, catalog);
    if (!result.ok) throw new Error(result.issues.join('; '));
    return { progress: result.value, warnings: result.issues };
  }
  if (!record(raw) || raw.version !== 1) throw new Error('Unsupported progress schema version');
  if (!Array.isArray(raw.completed) || !record(raw.placements)) throw new Error('Invalid legacy progress');
  const mapping = legacyMapping(catalog);
  const progress = createProgress(catalog);
  const warnings = [];
  const claimed = new Set(raw.completed.filter(id => Number.isInteger(id) && mapping.has(id)));
  const completed = new Set([...claimed].map(id => mapping.get(id)));
  progress.completed = catalog.campaignIds.filter(id => completed.has(id));
  if (claimed.size !== raw.completed.length) warnings.push('Unknown or duplicate legacy completed IDs removed');
  if (mapping.has(raw.currentLevel)) progress.currentLevelId = mapping.get(raw.currentLevel);
  else warnings.push('Unknown legacy current level reset');

  const access = new Set(progress.chapterAccess);
  for (const oldId of [...claimed, raw.currentLevel, ...Object.keys(raw.placements).map(Number)]) {
    const id = mapping.get(oldId);
    if (id) access.add(catalog.get(id).chapterId);
  }
  // The old demo opened a chapter when its first level's predecessor was completed.
  for (const boundary of [11, 21]) {
    if (Array.from({ length: boundary - 1 }, (_, i) => i + 1).every(id => claimed.has(id))) {
      const id = mapping.get(boundary);
      if (id) access.add(catalog.get(id).chapterId);
    }
  }
  progress.chapterAccess = catalog.chapters.filter(c => access.has(c.id)).map(c => c.id);
  for (const [oldId, placement] of Object.entries(raw.placements)) {
    const id = /^(?:[1-9]|[12][0-9]|30)$/.test(oldId) && mapping.get(Number(oldId));
    if (!id || !record(placement)) { warnings.push(`Invalid legacy placement ${oldId} ignored`); continue; }
    const level = catalog.get(id);
    const seats = new Set(level.seats.map(seat => seat.id));
    const used = new Set();
    const clean = {};
    for (const person of level.people) {
      if (!own(placement, person.id)) continue;
      const seat = placement[person.id];
      if (!seats.has(seat) || used.has(seat)) continue;
      Object.defineProperty(clean, person.id, { value: seat, enumerable: true });
      used.add(seat);
    }
    const incompatible = Object.keys(clean).length !== Object.keys(placement).length;
    if (incompatible) warnings.push(`Placement ${id} ${level.revision !== 1 ? 'reset after content revision change' : 'cleaned: invalid people/seats'}`);
    if (incompatible && level.revision !== 1) continue;
    progress.placements[id] = { contentRevision: level.revision, sessionId: `legacy-${id}`,
      moveSequence: 0, placement: clean, savedAt: 0 };
  }
  const result = validateProgress(progress, catalog);
  if (!result.ok) throw new Error(result.issues.join('; '));
  return { progress: result.value, warnings: [...warnings, ...result.issues] };
}
module.exports = { migrateV1 };
