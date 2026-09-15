'use strict';
const { validateProgress } = require('./schema');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const put = (object, key, value) => Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function union(local = [], remote = [], key = canonical) {
  const found = new Set();
  return [...local, ...remote].filter(value => {
    const id = key(value);
    if (found.has(id)) return false;
    found.add(id);
    return true;
  }).map(clone);
}

// Preserve unknown domain fields recursively. Local scalars/arrays win unless a
// domain's documented monotonic ledger is explicitly unioned below.
function localPreferred(local, remote) {
  const result = clone(remote);
  for (const [key, value] of Object.entries(local)) {
    put(result, key, record(value) && own(remote, key) && record(remote[key])
      ? localPreferred(value, remote[key]) : clone(value));
  }
  return result;
}

function checkedProgress(raw, catalog) {
  const checked = validateProgress(raw, catalog);
  if (!checked.ok) throw new Error(checked.issues.join('; '));
  // Validation reconciles compatible content for playback, but comparison must
  // use the original content revision; different revisions cannot share a clock.
  for (const id of [...catalog.campaignIds, ...catalog.dailyIds]) {
    if (own(raw.placements, id)) put(checked.value.placements, id, clone(raw.placements[id]));
  }
  return checked.value;
}

/** Pure merge. placementConflicts = [{levelId,local,remote}], also retained in merged
 * so saving before the player's choice does not discard either complete snapshot.
 * Caller must authorize the cloud identity before supplying remote progress.
 */
function mergeProgress(local, remote, catalog) {
  const a = checkedProgress(local, catalog), b = checkedProgress(remote, catalog);
  const merged = clone(a);
  const completed = new Set([...a.completed, ...b.completed]);
  merged.completed = catalog.campaignIds.filter(id => completed.has(id));
  const access = new Set([...a.chapterAccess, ...b.chapterAccess]);
  merged.chapterAccess = catalog.chapters.filter(chapter => access.has(chapter.id)).map(chapter => chapter.id);
  for (const domain of ['tutorial', 'daily', 'album', 'hintAccess', 'settings']) {
    merged[domain] = localPreferred(a[domain], b[domain]);
  }
  for (const [domain, key] of [['tutorial', 'completedSteps'], ['daily', 'completedDays'], ['album', 'claimedIds'],
    ['hintAccess', 'consumedIds'], ['hintAccess', 'fallbackClaimed']]) {
    merged[domain][key] = union(a[domain][key], b[domain][key]);
  }
  const grantKey = grant => grant.grantId ? `grant:${grant.grantId}` : grant.id ? `id:${grant.id}` : canonical(grant);
  merged.hintAccess.grants = union(a.hintAccess.grants, b.hintAccess.grants, grantKey).map(grant => {
    const remoteGrant = (b.hintAccess.grants || []).find(other => grantKey(other) === grantKey(grant));
    if (!remoteGrant) return grant;
    const combined = localPreferred(grant, remoteGrant);
    if (remoteGrant.recomputed || grant.recomputed) combined.recomputed = true;
    return combined;
  });
  const days = [a.daily.lastSeenDay, b.daily.lastSeenDay].filter(day => typeof day === 'string');
  merged.daily.lastSeenDay = days.sort().pop() || null;
  const known = new Set([...catalog.campaignIds, ...catalog.dailyIds]);
  let placementConflicts = union(a.placementConflicts, b.placementConflicts).filter(conflict => known.has(conflict.levelId));
  for (const [levelId, remoteSnapshot] of Object.entries(b.placements)) {
    const localSnapshot = a.placements[levelId];
    if (!localSnapshot) { put(merged.placements, levelId, clone(remoteSnapshot)); continue; }
    const comparable = localSnapshot.contentRevision === remoteSnapshot.contentRevision
      && localSnapshot.sessionId === remoteSnapshot.sessionId;
    if (comparable && localSnapshot.moveSequence !== remoteSnapshot.moveSequence) {
      if (remoteSnapshot.moveSequence > localSnapshot.moveSequence) put(merged.placements, levelId, clone(remoteSnapshot));
    } else if (!comparable || canonical(localSnapshot.placement) !== canonical(remoteSnapshot.placement)) {
      placementConflicts.push({ levelId, local: clone(localSnapshot), remote: clone(remoteSnapshot) });
    }
  }
  placementConflicts = union(placementConflicts);
  merged.placementConflicts = clone(placementConflicts);
  // Cloud revision and identity remain local. A merge is a local pending change,
  // not proof that any remote write was accepted.
  merged.sync.pending = true;
  return { merged, placementConflicts };
}

module.exports = { mergeProgress };
