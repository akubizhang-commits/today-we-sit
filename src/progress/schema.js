'use strict';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const strings = value => Array.isArray(value) && value.every(id => typeof id === 'string' && id.length > 0);
const clone = value => JSON.parse(JSON.stringify(value));

// Reject values JSON would silently discard or coerce, including cycles and class instances.
function jsonValue(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const valid = Object.keys(value).every(key => jsonValue(value[key], ancestors))
    && (!Array.isArray(value) || Array.from(value).every(item => item !== undefined));
  ancestors.delete(value);
  return valid;
}

function createProgress(catalog) {
  return {
    version: 2, contentVersion: catalog && catalog.contentVersion || '1.0.0', localRevision: 1,
    completed: [], currentLevelId: catalog && catalog.campaignIds[0] || null,
    chapterAccess: catalog && catalog.chapters.length ? [catalog.chapters[0].id] : [],
    placements: {}, tutorial: { completedSteps: [] }, daily: { lastSeenDay: null, completedDays: [] },
    album: { claimedIds: [] }, hintAccess: { grants: [], consumedIds: [], fallbackClaimed: [] },
    settings: { music: true, effects: true, vibration: true, reducedMotion: false },
    sync: { enabled: false, serverRevision: null, pending: false }
  };
}

function validSnapshot(snapshot) {
  return record(snapshot) && integer(snapshot.contentRevision) && snapshot.contentRevision > 0
    && typeof snapshot.sessionId === 'string' && snapshot.sessionId.length > 0
    && integer(snapshot.moveSequence) && Number.isFinite(snapshot.savedAt) && snapshot.savedAt >= 0
    && record(snapshot.placement) && Object.values(snapshot.placement).every(seat => typeof seat === 'string')
    && new Set(Object.values(snapshot.placement)).size === Object.keys(snapshot.placement).length;
}

function compatiblePlacement(placement, level) {
  const people = new Set((level.people || []).map(person => person.id));
  const seats = new Set((level.seats || []).map(seat => seat.id));
  return Object.entries(placement).every(([person, seat]) => people.has(person) && seats.has(seat));
}

/** Strict structural validation, then catalog reconciliation. Unknown JSON domain fields survive.
 * issues also contains nonfatal content reconciliation warnings; only ok determines validity.
 * catalog is optional for repository writes before a catalog has been attached by loadLocal.
 */
function validateProgress(raw, catalog) {
  const issues = [];
  const invalid = message => ({ ok: false, value: null, issues: [message] });
  try {
    if (!record(raw) || !jsonValue(raw)) return invalid('Progress must be a JSON object');
    if (raw.version !== 2) return invalid('Unsupported progress schema version');
    if (typeof raw.contentVersion !== 'string' || !integer(raw.localRevision)
        || !strings(raw.completed) || !strings(raw.chapterAccess)
        || !(raw.currentLevelId === null || typeof raw.currentLevelId === 'string')
        || !record(raw.placements)) return invalid('Invalid progress fields');
    for (const [id, snapshot] of Object.entries(raw.placements)) {
      if (!validSnapshot(snapshot)) return invalid(`Invalid placement snapshot: ${id}`);
    }
    for (const domain of ['tutorial', 'daily', 'album', 'hintAccess', 'settings', 'sync']) {
      if (!record(raw[domain])) return invalid(`Invalid ${domain} object`);
    }
    const arrays = [[raw.tutorial, 'completedSteps'], [raw.daily, 'completedDays'], [raw.album, 'claimedIds'],
      [raw.hintAccess, 'consumedIds'], [raw.hintAccess, 'fallbackClaimed']];
    for (const [object, key] of arrays) {
      if (own(object, key) && !strings(object[key])) return invalid(`Invalid ${key}`);
    }
    if (own(raw.hintAccess, 'grants') && (!Array.isArray(raw.hintAccess.grants)
        || !raw.hintAccess.grants.every(record))) return invalid('Invalid hint grants');
    for (const key of ['music', 'effects', 'vibration', 'reducedMotion']) {
      if (own(raw.settings, key) && typeof raw.settings[key] !== 'boolean') return invalid(`Invalid settings.${key}`);
    }
    for (const key of ['enabled', 'pending']) {
      if (own(raw.sync, key) && typeof raw.sync[key] !== 'boolean') return invalid(`Invalid sync.${key}`);
    }
    if (own(raw.sync, 'serverRevision') && raw.sync.serverRevision !== null && !integer(raw.sync.serverRevision)) return invalid('Invalid serverRevision');
    if (own(raw.daily, 'lastSeenDay') && raw.daily.lastSeenDay !== null
        && (typeof raw.daily.lastSeenDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.daily.lastSeenDay))) return invalid('Invalid lastSeenDay');
    if (own(raw, 'placementConflicts') && (!Array.isArray(raw.placementConflicts)
        || !raw.placementConflicts.every(c => record(c) && typeof c.levelId === 'string'
          && validSnapshot(c.local) && validSnapshot(c.remote)))) return invalid('Invalid placement conflicts');
    const value = clone(raw);
    if (catalog) {
      const claimed = new Set(value.completed);
      value.completed = catalog.campaignIds.filter(id => claimed.has(id));
      if (value.completed.length !== raw.completed.length) issues.push('Unknown or duplicate completed IDs removed');
      const access = new Set(value.chapterAccess);
      value.chapterAccess = catalog.chapters.filter(c => access.has(c.id)).map(c => c.id);
      const known = new Set([...catalog.campaignIds, ...catalog.dailyIds]);
      if (value.currentLevelId !== null && !known.has(value.currentLevelId)) {
        value.currentLevelId = catalog.campaignIds[0] || null;
        issues.push('Unknown current level reset');
      }
      for (const [id, snapshot] of Object.entries(value.placements)) {
        const level = known.has(id) && catalog.get(id);
        if (!level || !compatiblePlacement(snapshot.placement, level)) {
          delete value.placements[id];
          issues.push(`Placement ${id} reset: unknown level or incompatible people/seats`);
        } else if (snapshot.contentRevision !== level.revision) {
          snapshot.contentRevision = level.revision;
          issues.push(`Placement ${id} retained with compatible content revision ${level.revision}`);
        }
      }
    }
    return { ok: true, value, issues };
  } catch (_) { return invalid('Unreadable progress object'); }
}

module.exports = { createProgress, validateProgress };
