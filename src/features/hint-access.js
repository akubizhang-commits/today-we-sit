'use strict';
const clone = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const revision = value => value === undefined ? 1 : value;
const keyFor = (levelId, rev) => JSON.stringify([levelId, rev]);
const ledger = p => ({ grants: [], consumedIds: [], fallbackClaimed: [], ...p.hintAccess });
function validGrant(g) { return g && validId(g.grantId) && validId(g.levelId) && Number.isSafeInteger(g.contentRevision) && g.contentRevision > 0; }
/** Query L2 rights. L1 is always free. Proposed initial grants must be persisted via grant before consume.
 * @param {object} progress
 * @param {{levelId:string,displayNumber?:number,isDaily?:boolean,contentRevision?:number}} context
 * @returns {{free:boolean,unlimited:boolean,grant?:object,canFallback:boolean,canRequestAd:boolean}}
 */
function getAccess(progress, { levelId, displayNumber, isDaily = false, contentRevision = 1 } = {}) {
  const empty = { free: false, unlimited: false, canFallback: false, canRequestAd: false };
  if (!validId(levelId) || !Number.isSafeInteger(contentRevision) || contentRevision < 1) return empty;
  const l = ledger(progress), key = keyFor(levelId, contentRevision);
  const unlimited = !isDaily && Number.isInteger(displayNumber) && displayNumber >= 1 && displayNumber <= 10;
  const existing = l.grants.find(g => validGrant(g) && g.levelId === levelId
    && (g.contentRevision === contentRevision || g.source === 'rewarded') && !l.consumedIds.includes(g.grantId));
  const hadInitial = l.grants.some(g => g.levelId === levelId && g.contentRevision === contentRevision && g.source === 'initial');
  const proposed = { grantId: `initial:${key}`, levelId, contentRevision, source: 'initial' };
  const entitlement = existing || (!hadInitial ? proposed : null);
  const passes = new Set(progress.completed || []);
  const protectedComplete = Array.from({ length: 10 }, (_, i) => `bus-${String(i + 1).padStart(3, '0')}`).every(id => passes.has(id));
  return { free: unlimited || Boolean(entitlement), unlimited, ...(entitlement ? { grant: clone(entitlement) } : {}),
    canFallback: !unlimited && !l.fallbackClaimed.includes(key), canRequestAd: !unlimited && protectedComplete };
}
/** Mint a level/revision entitlement from verified service evidence; returns a NEW progress even on failure.
 * @param {object} progress
 * @param {{grantId:string,levelId:string,source:'initial'|'rewarded'|'fallback',contentRevision?:number,adResult?:object}} input
 * @returns {{progress:object,ok:boolean,reason:string|null,grant?:object}}
 */
function grant(progress, input = {}) {
  const next = clone(progress), l = ledger(next);
  const g = { grantId: input.grantId, levelId: input.levelId, source: input.source, contentRevision: revision(input.contentRevision) };
  const fail = reason => ({ progress: next, ok: false, reason });
  if (!validGrant(g) || !['initial', 'rewarded', 'fallback'].includes(g.source)) return fail('invalid-grant');
  if (l.grants.some(item => item.grantId === g.grantId) || l.consumedIds.includes(g.grantId)) return fail('duplicate-grant');
  const key = keyFor(g.levelId, g.contentRevision), result = input.adResult;
  if (g.source === 'initial' && g.grantId !== `initial:${key}`) return fail('invalid-grant');
  if (g.source === 'initial' && l.grants.some(item => item.levelId === g.levelId && item.contentRevision === g.contentRevision && item.source === 'initial')) return fail('initial-claimed');
  if (g.source !== 'initial') {
    if (!result || result.levelId !== g.levelId || !validId(result.requestId)) return fail('invalid-ad-result');
    if (g.source === 'rewarded' && (result.status !== 'earned' || result.requestId !== g.grantId)) return fail('invalid-ad-result');
    if (g.source === 'fallback' && !['unavailable', 'error'].includes(result.status)) return fail('invalid-ad-result');
    if (g.source === 'fallback' && result.reason
        && !['sdk-error', 'ad-error', 'no-fill', 'load-failed', 'show-failed', 'load-timeout', 'show-timeout'].includes(result.reason)) return fail('ineligible-fallback');
  }
  if (g.source === 'fallback' && l.fallbackClaimed.includes(key)) return fail('fallback-claimed');
  next.hintAccess = { ...l, grants: [...l.grants, g], fallbackClaimed: g.source === 'fallback' ? [...l.fallbackClaimed, key] : l.fallbackClaimed };
  return { progress: next, ok: true, reason: null, grant: clone(g) };
}
function jsonObject(value) {
  const ancestors = new Set();
  function visit(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (!v || typeof v !== 'object' || ancestors.has(v) || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype)) return false;
    ancestors.add(v);
    const ok = Object.values(v).every(visit) && (!Array.isArray(v) || Array.from(v).every(item => item !== undefined));
    ancestors.delete(v); return ok;
  }
  return value && typeof value === 'object' && !Array.isArray(value) && visit(value);
}
/** Atomically propose consumption + an exact JSON hintReceipt. Persist before displaying.
 * A repeated consume returns the original receipt without charging again. recompute:true permits one
 * replacement after a changed nonnegative integer placementRevision; no additional grant is consumed.
 * @param {object} progress @param {{grantId:string,levelId:string,hintReceipt:object,recompute?:boolean}} input
 * @returns {{progress:object,ok:boolean,reason:string|null,grant?:object,receipt?:object}}
 */
function consume(progress, { grantId, levelId, hintReceipt, recompute = false } = {}) {
  const next = clone(progress), l = ledger(next);
  const fail = (reason, receipt) => ({ progress: next, ok: false, reason, ...(receipt ? { receipt: clone(receipt) } : {}) });
  const index = l.grants.findIndex(g => g.grantId === grantId && g.levelId === levelId);
  if (index < 0) return fail('missing-grant');
  const g = l.grants[index], used = l.consumedIds.includes(grantId);
  if (used && !recompute) return fail('already-consumed', g.hintReceipt);
  if (!jsonObject(hintReceipt)) return fail('invalid-receipt');
  if (used && (g.recomputed || !g.hintReceipt || !Number.isSafeInteger(g.hintReceipt.placementRevision)
      || !Number.isSafeInteger(hintReceipt.placementRevision) || hintReceipt.placementRevision < 0
      || g.hintReceipt.placementRevision === hintReceipt.placementRevision)) return fail('recompute-unavailable', g.hintReceipt);
  const updated = { ...g, hintReceipt: clone(hintReceipt), ...(used ? { recomputed: true } : {}) };
  next.hintAccess = { ...l, grants: l.grants.map((item, i) => i === index ? updated : item), consumedIds: used ? l.consumedIds : [...l.consumedIds, grantId] };
  return { progress: next, ok: true, reason: null, grant: clone(updated), receipt: clone(hintReceipt) };
}
module.exports = { getAccess, grant, consume };
