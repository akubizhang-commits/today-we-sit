'use strict';
const { evaluate } = require('../core/engine');
const DAY = 86400000;
function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms / DAY : null;
}
/** Resolve a Shanghai calendar day and immutable 14-day build rotation. No clock or storage reads.
 * @param {{serverDay?:string,deviceNow?:number|Date,lastSeenDay?:string,anchorDay:string,ids:string[]}} options
 * @returns {{dayKey:string,levelId:string,isReplay:boolean,timeSource:string}}
 * @throws {TypeError} Invalid anchor or a cycle other than 14 distinct nonempty IDs.
 */
function resolve({ serverDay, deviceNow, lastSeenDay, anchorDay, ids } = {}) {
  const anchor = dayNumber(anchorDay);
  if (anchor === null || !Array.isArray(ids) || ids.length !== 14 || new Set(ids).size !== 14
      || ids.some(id => typeof id !== 'string' || !id.trim())) throw new TypeError('A valid anchor and 14 distinct daily IDs are required');
  const server = dayNumber(serverDay);
  let day = anchor, timeSource = 'anchor';
  if (server !== null) { day = server; timeSource = 'server'; }
  else {
    const ms = deviceNow instanceof Date ? deviceNow.getTime() : deviceNow;
    const device = typeof ms === 'number' && Number.isFinite(ms) ? Math.floor((ms + 8 * 3600000) / DAY) : null;
    if (device !== null && device >= day && device <= dayNumber('9999-12-31')) { day = device; timeSource = 'device'; }
    const last = dayNumber(lastSeenDay);
    if (last !== null && last > day) { day = last; timeSource = 'lastSeen'; }
  }
  const offset = day - anchor;
  return { dayKey: new Date(day * DAY).toISOString().slice(0, 10), levelId: ids[((offset % 14) + 14) % 14], isReplay: offset >= 14, timeSource };
}
/** Find the most recent unfinished saved daily before today (Shanghai day keys).
 * Catalog order and anchor determine identity; savedAt and currentLevelId do not.
 * Rule conflicts are resumable, but invalid person/seat references are not.
 * No clock, storage, solving, or input mutation.
 * @param {object} progress
 * @param {object} catalog
 * @param {string} todayDay
 * @returns {{levelId:string,dayKey:string}|null}
 */
function findResume(progress, catalog, todayDay) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const today = dayNumber(todayDay);
  const anchor = dayNumber(catalog && catalog.dailyCycleAnchorDay);
  const ids = catalog && catalog.dailyIds;
  if (today === null || anchor === null || today <= anchor
      || !record(progress) || !record(progress.placements)
      || !Array.isArray(ids) || ids.length !== 14 || new Set(ids).size !== 14
      || ids.some(id => typeof id !== 'string' || !id.trim())
      || typeof catalog.get !== 'function') return null;

  const completed = new Set(Array.isArray(progress.daily && progress.daily.completedDays)
    ? progress.daily.completedDays : []);
  let latest = null, latestDay = anchor - 1;
  for (const levelId of ids) {
    if (!Object.prototype.hasOwnProperty.call(progress.placements, levelId)) continue;
    const snapshot = progress.placements[levelId];
    if (!record(snapshot)) continue;
    const day = dayNumber(snapshot.dayKey);
    if (day === null || day < anchor || day >= today || day <= latestDay
        || completed.has(snapshot.dayKey) || ids[(day - anchor) % 14] !== levelId
        || !record(snapshot.placement)) continue;
    const entries = Object.entries(snapshot.placement);
    if (!entries.length) continue;
    const level = catalog.get(levelId);
    if (!level || !Number.isInteger(level.revision) || level.revision < 1
        || snapshot.contentRevision !== level.revision
        || !Array.isArray(level.people) || !Array.isArray(level.seats)) continue;
    const people = new Set(level.people.map(person => person.id));
    const seats = new Set(level.seats.map(seat => seat.id));
    if (entries.some(([person, seat]) => !people.has(person) || !seats.has(seat))
        || new Set(entries.map(([, seat]) => seat)).size !== entries.length) continue;
    if (evaluate(level, snapshot.placement).complete) continue;
    latest = { levelId, dayKey: snapshot.dayKey };
    latestDay = day;
  }
  return latest;
}
module.exports = { resolve, findResume };
