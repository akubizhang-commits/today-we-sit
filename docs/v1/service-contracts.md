# v1 pure features and service contracts

CommonJS, dependency free. Platform/network effects require injected adapters; ad deadlines default to injectable host timers. All progress arguments are JSON snapshots; pure updates return new snapshots and never persist or increment revisions. The app validates/saves the whole snapshot atomically before adopting it. Existing in-progress daily sessions retain their original day/level.

## Integration API

- `daily.resolve({serverDay,deviceNow,lastSeenDay,anchorDay,ids})` → `{dayKey,levelId,isReplay,timeSource}`. `deviceNow` is epoch milliseconds or Date, dates are strict YYYY-MM-DD. Shanghai UTC+08:00 midnight; exactly 14 unique IDs and a fixed build anchor required. Valid server day takes precedence; offline day is max(device day, last seen, anchor). Sources: `server`, `device`, `lastSeen`, `anchor`. Second and subsequent cycles are replays. Invalid anchor/IDs throw; invalid clocks fall back safely.
- `album.getCards(completed,claimedIds[,campaignIds])` → 12 `{id,title,threshold,unlocked,claimed,scene}` cards, stable IDs `album-01`…`album-12`. Distinct published campaign completions only. Default release membership is bus/garden/cinema 001…030; pass the actual manifest campaignIds as third argument for a different catalog. `album.claim(progress,id[,campaignIds])` → new progress, no-op for locked/unknown/already claimed cards.
- `tutorial.getText(levelDisplayNumber,session,result,progress)` → string (empty when complete/inapplicable). `tutorial.advance(progress,action,levelNumber)` → new progress. Verified actions: level 1 `select`, 2 `place`, 3 `conflict`, 4 `swap` or `undo`, 5 `relation` then `emptyNeighbor`. `rule:tag`, `rule:notTag`, `rule:zone`, `rule:adjacent`, `rule:apart`, `rule:emptyNeighbor` record a viewed rule explanation. The app submits actions only after real interaction. Session may supply `ruleType` for first-appearance explanations.
- `settings.toggle(progress,key)` → new progress. Keys: music/effects/vibration/reducedMotion; unknown keys are harmless no-ops.
- `hintAccess.getAccess(progress,{levelId,displayNumber,isDaily,contentRevision=1})` → `{free,unlimited,grant?,canFallback,canRequestAd}`. Mainline 1–10 unlimited; otherwise one initial grant per level revision. Ads require completion of bus-001…010. `grant` is an existing available entitlement or a proposed deterministic initial grant (persist it before consuming).
- `hintAccess.grant(progress,{grantId,levelId,source,contentRevision=1,adResult?})` and `consume(progress,{grantId,levelId,hintReceipt})` → `{progress,ok,reason,grant?,receipt?}`. Sources initial/rewarded/fallback. Initial grants must use the deterministic grantId returned by getAccess. Rewarded requires matching earned `adResult` and uses its requestId as grantId; earned grants remain available across content revisions. Fallback requires a matching unavailable/error result: absent reason or sdk-error/ad-error/no-fill/load-failed/show-failed/load-timeout/show-timeout. Busy/cooldown/cap/duplicate/configuration denials never qualify; not-configured and timer-error remain ineligible. Timeout fallback is a separate once-per-level/revision relief grant, never a rewarded-ad completion. Duplicate grant IDs never mint another entitlement. Fallback and initial dedupe by level + revision. Receipts are JSON objects retained exactly on the grant; consumedIds updates in the SAME returned snapshot. Repeating the same consume returns the stored receipt with reason `already-consumed` and `ok:false`; a different receipt cannot overwrite it. Pure functions do not establish platform trust: app passes only results from its injected ad service. Persist failures must discard the returned snapshot. Layout-change recomputation uses `consume(...,{recompute:true,...})` once with a changed `hintReceipt.placementRevision`; it replaces the receipt without another entitlement charge.
- `createAdService({createAd,now,minIntervalMs=90000,maxPerSession=3,setTimeout,clearTimeout,loadTimeoutMs=15000,showTimeoutMs=180000})` → `{request,getState}`. `request({requestId,levelId,sessionId?})` resolves `{status,requestId,levelId,reason?}`; terminal statuses earned/cancelled/unavailable/error. `getState()` returns `{status,requestId,levelId,completed,sessionCompleted}`. `completed` remains the cumulative earned total for this service instance; `sessionCompleted` counts earned ads for the request currently represented by state (zero at initialization). Factory returns a fresh standard ad object (`load/show/onClose/offClose/onError/offError`), or null when unconfigured/unauthorized. Requests are serialized; reused request IDs fail closed, including when bound to another level. Reward only on `isEnded === true` during showing. Stale SDK callbacks, promise settlements and retired timer callbacks are ignored. Load and show/close waits are bounded by injectable timers (details below). Cooldown starts on successful completion; cancellations/errors do not count toward the cap. Limits can only be more conservative than 90 seconds / 3 completions. The cap is keyed by optional `sessionId`; omitting it preserves one legacy session for the service instance. Cooldown and request-ID deduplication remain global to the instance. Do not reconstruct the service per request.
- `config.resolve(raw,{now,publishedIds})` → safe whitelisted config. `createConfigService({now,publishedIds})` → `{update,get}`; no network. Input schema `{schemaVersion:1,version,expiresAt,ads:{enabled,minIntervalMs,maxPerSession},telemetry:{sampleRate},pausedLevelIds}`. Unknown fields are ignored, invalid known fields/expired config fail closed (ads off, sampleRate 0). Valid config cannot raise ad intensity; paused IDs must be published. Cache accepts strictly newer versions, identical valid repeats, and revalidates expiry on read.
- `createTelemetry({transport,now,createId,buildId,contentVersion,environment='development',sampleRate=1,random})` → `{setConsent,track,getQueue,flush}`. `setConsent(true,consentVersion)` creates anonymous installation/session IDs only after consent; revocation clears queue, IDs and deduplication. `track(name,fields={},eventId?)` returns boolean. Only the 15 doc06 names and whitelisted scalar metadata survive; no free text, answers, credentials, income or user IDs. Queue ≤200 events and ≤256 KiB UTF-8 serialized JSON, dropping oldest ordinary event before errors. No automatic network. `flush()` sends at most 50 events via `transport(batch)` and removes only explicit `acceptedIds`. Missing/failing transport retains events. Concurrent flushes share one operation. Batch includes schemaVersion, batchId, consentVersion, environment and events; production transport must reject development batches. Retry preserves event IDs; receiver dedupes eventId. No installation ID is stored by this module across constructions. Raw events expire after 30 days, errors after 14 days; server owns aggregate retention (90 days) and deletion.

## Responsibility boundary

No platform SDK, network clients, credentials, revenue estimates or fake completed ads are provided. Ad deadlines use injectable host timers. App owns visibility checks, foreground/session lifecycle, platform configuration, daily unlock after five campaign passes, preserving old-day results, UI display after successful persistence, and restoring hint receipts. A missing SDK load/show/close callback settles error at the corresponding service deadline and releases the active request. The adapter still owns the physical ad lifecycle: the service retires requests and listeners, but cannot abort an underlying SDK promise or dismiss an SDK screen through this interface. Actual platform integration and production privacy/retention operations require separate evidence.

## Ad timeout fields and timer contract

| Option | Default | Contract |
| --- | --- | --- |
| `setTimeout(fn, delayMs)` | Host `setTimeout` | Injectable scheduler; returns an opaque handle (including zero). Inject together with `clearTimeout` for deterministic tests. |
| `clearTimeout(handle)` | Host `clearTimeout` | Cancels a scheduled callback. Already queued/late callbacks are harmless through request-token and timer-phase checks. |
| `loadTimeoutMs` | `15000` | Deadline from adapter/listener setup until `load()` resolves. |
| `showTimeoutMs` | `180000` | One deadline starting immediately before `show()`, covering both its promise and the wait for `onClose`. Resolving `show()` does not clear or restart this timer. |

Timeout durations accept finite positive numbers up to 2,147,483,647 milliseconds; fractional values round up. Zero, negatives, nonnumeric/nonfinite values and larger values fall back to the respective default, so invalid configuration cannot disable a deadline. Timer scheduling follows the host event loop; these deadlines do not interrupt synchronous SDK code.

- Loading expiry resolves `{status:'error', reason:'load-timeout', requestId, levelId}`.
- Showing/close expiry resolves `{status:'error', reason:'show-timeout', requestId, levelId}`.
- Scheduler setup failure resolves `error` with `timer-error` and does not start SDK work without a deadline. This infrastructure failure does not qualify for fallback.
- Each terminal path retires its request token before external cleanup, cancels its timer and attempts both `offClose` and `offError`. Cleanup exceptions do not alter settlement. The load timer is retired before starting the show timer; even manually invoked retired timers cannot expire the next phase.
- Timeouts never increment completed ads, start earned cooldown, or produce `earned`. A retry with a fresh request ID may start immediately. Global duplicate-ID and 90-second cooldown semantics are unchanged; per-session cap behavior is described below.
- A late load cannot call `show()` after its request has timed out. Late load/show rejections, close/error events and timer callbacks cannot settle a later request or reward its level.
- `hintAccess.grant` accepts `load-timeout`/`show-timeout` as fallback failure reasons with original level/request binding. It retains existing per-level/revision deduplication and all prior failure reasons. Missing-platform `not-configured` is still rejected; no absent SDK can manufacture an ad success or fallback grant.

Deterministic regressions in `tests/ad-service.test.js` cover the exact default boundaries, injected durations, unresolved promises, missing close, timer/listener cleanup, stale phase callbacks, cross-request races, invalid duration defaults and scheduler/cleanup failures. `tests/features-v1.test.js` verifies the real service's timeout results can grant one fallback, cannot be used as rewarded evidence, and do not loosen platform/policy denials.

## Per-play-session ad cap

`request({requestId, levelId, sessionId})` accepts an optional nonblank string up to 256 characters. Explicit null, nonstrings, whitespace-only IDs and longer strings resolve unavailable/invalid-request without starting an adapter. Omitted/undefined `sessionId` uses a private legacy bucket, separate from all explicit strings (including `"legacy"`). Existing callers that omit the field retain their original instance-wide cap.

- `maxPerSession` still defaults to 3 and can only reduce that cap. Only `earned` increments the original request's session count. Switching level IDs within one session does not reset it; revisiting a session retains its count.
- Requests capture the session key by value when created. Mutating the caller's input, attempting a new-session request while busy, or receiving an old callback cannot redirect a completion to a new session. Already-settled requests ignore all further callbacks.
- The 90-second minimum cooldown uses the most recent earned completion across **all** sessions, including the legacy session. Starting a fresh session cannot bypass it. Cancellations/errors/timeouts neither increment a session count nor start a new cooldown.
- `getState().completed` is cumulative across sessions. `sessionCompleted` describes the session of the displayed active or latest nonbusy request. A denied busy request does not replace the displayed active request. An immediate cooldown/cap denial with no active request displays the denied request's session count.
- App integration can pass its stable `playSessionId` in each request. The app owns the real play-session boundary; IDs should not be regenerated per ad. No app changes are included in this service change.

Cross-session regressions cover independent caps, shared cooldown at 89,999/90,000ms, cumulative versus per-session counters, immutable original binding, late callbacks, timed-out-session retries and legacy callers.

## Verified integration sequence

```js
const access = hintAccess.getAccess(progress, context);
// For a non-unlimited entitlement, ensure access.grant is in the saved ledger.
// For earned ads, use the original request level, even after navigation.
const earned = await ads.request({ requestId, levelId });
if (earned.status === 'earned') {
  const proposal = hintAccess.grant(progress, {
    grantId: earned.requestId, levelId: earned.levelId,
    source: 'rewarded', contentRevision, adResult: earned
  });
  if (proposal.ok && (await saveLocal(storage, proposal.progress)).ok) {
    progress = proposal.progress;
  }
}
// Compute asynchronously against a captured placement; recheck that placement
// before proposing consumption. Unlimited tutorial access needs no ledger charge.
const proposal = hintAccess.consume(progress, { grantId, levelId, hintReceipt });
if (proposal.ok && (await saveLocal(storage, proposal.progress)).ok) {
  progress = proposal.progress;
  // Display proposal.receipt only if its original level/layout is still current.
}
```

The app must serialize these read/modify/save operations against its latest progress,
including callbacks arriving while another save is pending. A cloned stale snapshot
is not a transaction and must not overwrite a newer grant or completion. `hintReceipt`
is an app-defined JSON object: include the original level/layout identity,
`placementRevision`, and the exact computed hint/report required for restoration.
The domain deliberately preserves that report instead of interpreting worker output.
