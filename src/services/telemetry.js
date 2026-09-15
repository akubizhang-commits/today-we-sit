'use strict';
const names = new Set(['app_open', 'tutorial_complete', 'level_start', 'level_exit', 'level_complete', 'hint_request', 'hint_granted',
  'ad_request', 'ad_show', 'ad_complete', 'ad_cancel', 'ad_error', 'daily_complete', 'storage_error', 'runtime_error']);
const errors = new Set(['ad_error', 'storage_error', 'runtime_error']);
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const stringFields = ['levelId', 'requestId', 'source', 'status', 'code', 'dayKey'];
const numberFields = ['displayNumber', 'durationMs', 'moveCount', 'contentRevision'];
// Portable UTF-8 count, including surrogate pairs, without Node Buffer or browser TextEncoder.
function bytes(value) {
  let count = 0;
  for (const character of JSON.stringify(value)) {
    const code = character.codePointAt(0); count += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return count;
}
/** Consent-gated local anonymous telemetry; transport is explicit and ONLY called by flush().
 * IDs are scoped to a consent epoch, not recovered from device identifiers. No storage or network clients.
 * @param {{transport?:Function,now?:()=>number,createId?:()=>string,buildId?:string,contentVersion?:string,
 * environment?:'development'|'production',sampleRate?:number,random?:()=>number}} [options]
 * @returns {{setConsent:Function,track:Function,getQueue:Function,flush:Function}}
 */
function createTelemetry({ transport, now = Date.now, createId = () => `anon-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
  buildId = 'unknown', contentVersion = 'unknown', environment = 'development', sampleRate = 1, random = Math.random } = {}) {
  const rate = Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 1 ? sampleRate : 0;
  const env = environment === 'production' ? 'production' : 'development';
  const build = text(buildId) ? buildId : 'unknown', version = text(contentVersion) ? contentVersion : 'unknown';
  let consent = false, consentVersion = null, installationId = null, sessionId = null, epoch = 0;
  let queue = [], pending = null;
  const seen = new Set();
  const time = () => { try { const value = now(); return Number.isFinite(value) ? value : null; } catch (_) { return null; } };
  function prune() {
    const at = time();
    if (at !== null) queue = queue.filter(e => at - e.timestamp < (errors.has(e.name) ? 14 : 30) * 86400000);
  }
  /** Enable only with a nonempty consent version; revoke clears queued events and anonymous IDs.
   * @param {boolean} enabled @param {string} [version] @returns {boolean} effective consent
   */
  function setConsent(enabled, version) {
    if (enabled === true && text(version) && consent && consentVersion === version) return true;
    epoch++; consent = false; consentVersion = null; installationId = null; sessionId = null; queue = []; seen.clear();
    if (enabled !== true || !text(version)) return false;
    try {
      const install = createId(), session = createId();
      if (!text(install) || !text(session) || install === session) return false;
      installationId = install; sessionId = session; consentVersion = version; consent = true;
    } catch (_) { return false; }
    return consent;
  }
  /** Queue a dictionary event with allowlisted scalar metadata. Returns false for denial, sampling,
   * duplicate IDs, invalid input, or when the event itself is evicted by the bounded queue.
   * @param {string} name @param {object} [fields] @param {string} [eventId] @returns {boolean}
   */
  function track(name, fields = {}, eventId) {
    if (!consent || !names.has(name)) return false;
    const at = time(); if (at === null) return false;
    try {
      if (rate === 0 || (rate < 1 && !(random() < rate))) return false;
      const id = eventId === undefined ? createId() : eventId;
      if (!text(id) || seen.has(id)) return false;
      const event = { schemaVersion: 1, eventId: id, name, timestamp: at, installationId, sessionId,
        buildId: build, contentVersion: version, environment: env };
      if (fields && typeof fields === 'object') {
        for (const key of stringFields) if (text(fields[key])) event[key] = fields[key];
        for (const key of numberFields) if (Number.isFinite(fields[key]) && fields[key] >= 0) event[key] = fields[key];
      }
      prune(); queue.push(event); seen.add(id);
      while (queue.length > 200 || bytes(queue) > 256 * 1024) {
        const ordinary = queue.findIndex(item => !errors.has(item.name)); queue.splice(ordinary < 0 ? 0 : ordinary, 1);
      }
      return queue.includes(event);
    } catch (_) { return false; }
  }
  /** Read an isolated queue snapshot after retention pruning. @returns {object[]} */
  function getQueue() { prune(); return clone(queue); }
  /** Send at most 50 events once, never retry automatically; remove only explicitly acknowledged IDs.
   * A concurrent flush shares the in-flight promise. Revoked consent invalidates late acknowledgements.
   * @returns {Promise<{status:string,accepted:number}>}
   */
  function flush() {
    if (!consent) return Promise.resolve({ status: 'disabled', accepted: 0 });
    if (pending) return pending;
    prune();
    if (!queue.length) return Promise.resolve({ status: 'empty', accepted: 0 });
    if (typeof transport !== 'function') return Promise.resolve({ status: 'unavailable', accepted: 0 });
    let batch;
    try {
      const batchId = createId(); if (!text(batchId)) throw new Error('Invalid anonymous batch ID');
      batch = { schemaVersion: 1, batchId, consentVersion, environment: env, events: clone(queue.slice(0, 50)) };
    } catch (_) { return Promise.resolve({ status: 'error', accepted: 0 }); }
    const sentIds = new Set(batch.events.map(e => e.eventId)), sentEpoch = epoch;
    // Publish pending before invoking a possibly synchronous/reentrant transport.
    let settle;
    const operation = new Promise(resolve => { settle = resolve; }); pending = operation;
    const finish = result => { if (pending === operation) pending = null; settle(result); };
    try {
      Promise.resolve(transport(batch)).then(response => {
        if (!consent || epoch !== sentEpoch) { finish({ status: 'revoked', accepted: 0 }); return; }
        if (!response || !Array.isArray(response.acceptedIds)) { finish({ status: 'error', accepted: 0 }); return; }
        const accepted = new Set(response.acceptedIds.filter(id => sentIds.has(id)));
        queue = queue.filter(event => !accepted.has(event.eventId));
        finish({ status: 'sent', accepted: accepted.size });
      }, () => finish({ status: 'error', accepted: 0 }));
    } catch (_) { finish({ status: 'error', accepted: 0 }); }
    return operation;
  }
  return { setConsent, track, getQueue, flush };
}
module.exports = { createTelemetry };
