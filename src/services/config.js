'use strict';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const clone = value => JSON.parse(JSON.stringify(value));
function safe() { return { schemaVersion: 1, version: 0, expiresAt: 0, ads: { enabled: false, minIntervalMs: 90000, maxPerSession: 3 }, telemetry: { sampleRate: 0 }, pausedLevelIds: [] }; }
/** Validate local/injected config. Invalid/expired known fields fail closed; unknown fields are ignored.
 * Advertising may only be disabled, spaced further apart or capped lower than release defaults.
 * @param {object} raw @param {{now?:number,publishedIds?:string[]}} [options] @returns {object}
 */
function resolve(raw, { now = Date.now(), publishedIds = [] } = {}) {
  if (!record(raw) || raw.schemaVersion !== 1 || !Number.isSafeInteger(raw.version) || raw.version < 1
      || !Number.isFinite(now) || !Number.isFinite(raw.expiresAt) || raw.expiresAt <= now) return safe();
  const value = safe(); value.version = raw.version; value.expiresAt = raw.expiresAt;
  if (own(raw, 'ads')) {
    const ad = raw.ads;
    if (!record(ad) || (own(ad, 'enabled') && typeof ad.enabled !== 'boolean')
        || (own(ad, 'minIntervalMs') && (!Number.isSafeInteger(ad.minIntervalMs) || ad.minIntervalMs < 90000))
        || (own(ad, 'maxPerSession') && (!Number.isInteger(ad.maxPerSession) || ad.maxPerSession < 0 || ad.maxPerSession > 3))) return safe();
    for (const key of ['enabled', 'minIntervalMs', 'maxPerSession']) if (own(ad, key)) value.ads[key] = ad[key];
    if (value.ads.maxPerSession === 0) value.ads.enabled = false;
  }
  if (own(raw, 'telemetry')) {
    if (!record(raw.telemetry) || (own(raw.telemetry, 'sampleRate') && (!Number.isFinite(raw.telemetry.sampleRate) || raw.telemetry.sampleRate < 0 || raw.telemetry.sampleRate > 1))) return safe();
    if (own(raw.telemetry, 'sampleRate')) value.telemetry.sampleRate = raw.telemetry.sampleRate;
  }
  if (own(raw, 'pausedLevelIds')) {
    if (!Array.isArray(raw.pausedLevelIds) || raw.pausedLevelIds.some(id => typeof id !== 'string')) return safe();
    const published = new Set(publishedIds);
    value.pausedLevelIds = [...new Set(raw.pausedLevelIds.filter(id => published.has(id)))];
  }
  return value;
}
/** Explicit local cache, with version rollback prevention and expiry checked on each read; no fetch.
 * @param {{now?:()=>number,publishedIds?:string[]}} [options]
 * @returns {{update:Function,get:Function}}
 */
function createConfigService({ now = Date.now, publishedIds = [] } = {}) {
  let cached = safe();
  const ids = [...publishedIds];
  const readTime = () => { try { return now(); } catch (_) { return NaN; } };
  /** Read an isolated, currently valid config, otherwise safe defaults. @returns {object} */
  function get() { return resolve(cached, { now: readTime(), publishedIds: ids }); }
  /** Accept a newer valid version; invalid input keeps a still-valid cached version. @param {object} raw @returns {object} */
  function update(raw) {
    const value = resolve(raw, { now: readTime(), publishedIds: ids });
    if (value.version > cached.version) cached = clone(value);
    return get();
  }
  return { update, get };
}
module.exports = { resolve, createConfigService };
