'use strict';
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
const boundedTimeout = (value, fallback) =>
  Number.isFinite(value) && value > 0 && value <= 2147483647 ? Math.ceil(value) : fallback;
/** Create an SDK-independent rewarded-ad state machine. Missing factory/null means unavailable.
 * The platform owns adUnitId/authorization and supplies a standard ad with load/show/onClose/
 * offClose/onError/offError. Timers bound SDK waits; they never manufacture a completion.
 * @param {{createAd?:Function,now?:()=>number,minIntervalMs?:number,maxPerSession?:number,
 * setTimeout?:Function,clearTimeout?:Function,loadTimeoutMs?:number,showTimeoutMs?:number}} [options]
 * @returns {{request:Function,getState:Function}}
 */
function createAdService({
  createAd, now = Date.now, minIntervalMs = 90000, maxPerSession = 3,
  setTimeout: scheduleTimeout = setTimeout, clearTimeout: cancelTimeout = clearTimeout,
  loadTimeoutMs = 15000, showTimeoutMs = 180000
} = {}) {
  const interval = Number.isFinite(minIntervalMs) ? Math.max(90000, minIntervalMs) : 90000;
  const cap = Number.isInteger(maxPerSession) ? Math.max(0, Math.min(3, maxPerSession)) : 3;
  const loadLimit = boundedTimeout(loadTimeoutMs, 15000);
  const showLimit = boundedTimeout(showTimeoutMs, 180000);
  const usedIds = new Set();
  const legacySession = Symbol('legacy-session'), sessionCounts = new Map();
  let active = null, completed = 0, lastEarnedAt = null;
  let stateSession = legacySession;
  let state = { status: 'idle', requestId: null, levelId: null };
  const clock = () => { try { const value = now(); return Number.isFinite(value) ? value : null; } catch (_) { return null; } };
  /** completed is the lifetime earned total; sessionCompleted belongs to the displayed request.
   * Busy attempts preserve the active request's state and session.
   * @returns {{status:string,requestId:string|null,levelId:string|null,completed:number,sessionCompleted:number}}
   */
  function getState() { return { ...state, completed, sessionCompleted: sessionCounts.get(stateSession) || 0 }; }
  /** A unique request settles once and retains its ORIGINAL level/session binding. Busy, duplicate,
   * missing adapter, cooldown and cap requests resolve unavailable with a machine-readable reason.
   * Omitted sessionId uses one legacy session for this service instance. Cooldown remains global.
   * @param {{requestId:string,levelId:string,sessionId?:string}} input
   * @returns {Promise<{status:'earned'|'cancelled'|'unavailable'|'error',requestId:string,levelId:string,reason?:string}>}
   */
  function request({ requestId, levelId, sessionId } = {}) {
    const sessionKey = sessionId === undefined ? legacySession : sessionId;
    const result = (status, reason) => ({ status, requestId, levelId, ...(reason ? { reason } : {}) });
    const setState = status => { state = { status, requestId, levelId }; stateSession = sessionKey; };
    const immediate = (status, reason) => {
      if (!active) setState(status);
      return Promise.resolve(result(status, reason));
    };
    const unavailable = reason => immediate('unavailable', reason);
    if (!validId(requestId) || !validId(levelId) || (sessionId !== undefined && !validId(sessionId))) return unavailable('invalid-request');
    if (usedIds.has(requestId)) return unavailable('duplicate-request');
    usedIds.add(requestId);
    if (active) return unavailable('busy');
    if ((sessionCounts.get(sessionKey) || 0) >= cap) return unavailable('session-cap');
    const startedAt = clock();
    if (startedAt === null) return immediate('error', 'invalid-clock');
    if (lastEarnedAt !== null && startedAt - lastEarnedAt < interval) return unavailable('cooldown');
    if (typeof createAd !== 'function') return unavailable('not-configured');
    const token = { requestId, levelId, sessionKey };
    active = token; setState('loading');
    return new Promise(resolve => {
      let ad, settled = false, closeAttached = false, errorAttached = false, timeout = null;
      const current = () => !settled && active === token;
      function clearTimer() {
        const previous = timeout;
        // Retire the phase before external cancellation, even if cancellation fails/re-enters.
        timeout = null;
        if (previous && previous.assigned) {
          try { cancelTimeout(previous.id); } catch (_) { /* Retired phase ignores queued callbacks. */ }
        }
      }
      function armTimer(delay, reason) {
        if (!current()) return false;
        const phase = { assigned: false };
        timeout = phase;
        try {
          phase.id = scheduleTimeout(() => {
            if (timeout === phase && current()) finish('error', reason);
          }, delay);
          phase.assigned = true;
          // Also handle injected schedulers that invoke a callback before returning its handle.
          if (timeout !== phase) {
            try { cancelTimeout(phase.id); } catch (_) { /* The token is already retired. */ }
          }
        } catch (_) { finish('error', 'timer-error'); }
        return current() && timeout === phase;
      }
      function finish(status, reason) {
        if (settled || active !== token) return;
        settled = true;
        // Retire this token before calling external cleanup, which may itself invoke callbacks.
        active = null;
        if (status === 'earned') {
          completed++;
          sessionCounts.set(token.sessionKey, (sessionCounts.get(token.sessionKey) || 0) + 1);
          lastEarnedAt = clock() ?? startedAt;
        }
        setState(status);
        clearTimer();
        try { if (closeAttached) ad.offClose(onClose); } catch (_) { /* Retired token still blocks callbacks. */ }
        try { if (errorAttached) ad.offError(onError); } catch (_) { /* Cleanup cannot alter the result. */ }
        resolve(result(status, reason));
      }
      function onClose(event) {
        if (active !== token || state.status !== 'showing') return;
        finish(event && event.isEnded === true ? 'earned' : 'cancelled');
      }
      function onError() { finish('error', 'ad-error'); }
      try {
        ad = createAd();
        if (!ad) { finish('unavailable', 'not-configured'); return; }
        if (['load', 'show', 'onClose', 'offClose', 'onError', 'offError'].some(name => typeof ad[name] !== 'function')) {
          finish('unavailable', 'invalid-adapter'); return;
        }
        closeAttached = true; ad.onClose(onClose);
        if (settled) return;
        errorAttached = true; ad.onError(onError);
        if (settled) return;
      } catch (_) { finish('error', 'adapter-error'); return; }
      if (!armTimer(loadLimit, 'load-timeout')) return;
      Promise.resolve().then(() => {
        if (current()) return ad.load();
      }).then(() => {
        if (!current()) return;
        clearTimer();
        if (!current()) return;
        setState('showing');
        // One deadline covers show() AND the close callback, even if show() resolves early.
        if (!armTimer(showLimit, 'show-timeout')) return;
        return ad.show();
      }).catch(() => finish('error', 'sdk-error'));
    });
  }
  return { request, getState };
}
module.exports = { createAdService };
