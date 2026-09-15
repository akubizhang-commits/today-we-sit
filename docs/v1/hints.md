# Cooperative advanced hints

`src/core/hints.js` exports a CommonJS async API:

```js
const { getAdvancedHint } = require('./core/hints');

const result = await getAdvancedHint(level, placement, {
  nodeBudget: 60000,
  yieldEvery: 128,
  yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
  isCancelled: () => false
});
```

All options are optional. This is local gameplay computation for the original
levels of at most eight people. It uses `engine.evaluate` and adds no dependencies,
network access, or synchronous calls to `engine.solve` / `engine.getHint`.

| Status | Meaning |
| --- | --- |
| `ready` | Includes `hint: { personId, seatId, text }`. Apply exactly one session move. |
| `complete` | The supplied placement already satisfies every requirement, including alternate solutions. |
| `budgetExceeded` | The shared work limit stopped the search; this does **not** establish impossibility. |
| `unsolvable` | Exhaustive search found no solution, or the supplied placement is structurally invalid. |
| `cancelled` | `isCancelled()` returned true; discard this request. |

Only `ready` includes `hint`. `seatId: null` means return the person to the waiting
area. A non-null seat uses the existing session semantics: move to an empty seat,
swap with its occupant when already seated, or displace its occupant to the
waiting area when entering from there.

## Preservation and repair

The search first fixes every current assignment. If a solution extends it, the
hint seats an unseated person without changing any existing assignment. It does
not compare the layout against a single canonical answer.

If the current assignments cannot all be retained, it searches subsets in
descending size and finds a solution preserving the maximum possible number.
Candidate domains use `evaluate`, minimum remaining candidates, and sound
`emptyNeighbor` pruning: occupied neighbors cannot become empty while a search
branch adds people. Directed relations are checked by the engine.

For repairs, each candidate move is simulated with session swap/displacement
semantics and searched again. A move is offered only if its resulting layout
can be completed. If none of these target moves works, the hint unseats an assignment that
differs from the chosen maximum-retention solution and explains why a staged
repair is needed. Every search, including these move checks, shares the budget.
No provisional hint escapes when that budget runs out.

This avoids repair cycles without retaining hidden state across calls. Let `k`
be the number currently seated and `m` the maximum number of those assignments
that a solution can preserve. Unseating a mismatch decreases `k - m` by one:
the retained optimal subset remains possible, and removing an assignment cannot
increase `m`. A certified repair makes `k - m` zero. Once zero, every hint seats
another person and preserves the rest. Thus applying successive `ready` hints
eventually completes a solvable level, provided each computation has enough
budget and the player does not make intervening changes.

Text says “一种可行安排”; finding one solution does not establish a uniquely
deduced move. Repair text explains the swap, displacement, or return to waiting.

## Work limits and scheduling

`nodeBudget` is a nonnegative safe integer; `yieldEvery` is a positive safe
integer. Invalid values reject with `RangeError`, and non-function callbacks
reject with `TypeError`. Callback failures propagate to the caller.

The budget counts concrete work checkpoints: initial validation, each engine
evaluation, search/subset expansion, candidate seat probe (including occupied
seats), candidate branch, and repair move probe. It is more conservative than
counting only completed placements or recursive search nodes. It is never reset
between fixed-subset attempts or repair checks.

Before executing each work unit, the driver checks cancellation and remaining
budget. Every `yieldEvery` reserved units, it awaits `yieldControl` and checks
cancellation again before continuing. It also checks cancellation before
returning a result. Cancellation takes precedence over budget exhaustion.
A zero budget returns `budgetExceeded` without evaluating a layout, unless
already cancelled. A result requiring exactly the budget can still succeed.

This bounds search work, not milliseconds. A single engine evaluation and input
snapshot are synchronous; the level is expected to follow the existing engine
schema and original small-level limits. Input validation rejects unknown people
or seats, duplicate occupied seats, non-object placements, and duplicate level
IDs for people/seats as `unsolvable`; it is not a general level-schema validator.

The default timer callback gives the event loop an opportunity to render and
process input. A custom callback must yield to the host event loop to offer the
same responsiveness; `Promise.resolve()` alone only yields to microtasks.
Budget exhaustion has no resumable cursor. A retry starts fresh, so repeatedly
retrying an insufficient budget will not advance the search.

## Awaiting and cancelling in main

The module snapshots placement and the level fields it reads before the first
await. It never mutates caller data. Main owns the request lifetime and must
cancel or discard results when the level, placement, or active request changes.
For example, using a generation counter incremented on each such change:

```js
const generation = hintGeneration;
const result = await getAdvancedHint(level, placement, {
  isCancelled: () => generation !== hintGeneration
});
if (generation !== hintGeneration || result.status === 'cancelled') return;
if (result.status === 'ready') showHint(result.hint);
// Handle complete, budgetExceeded and unsolvable separately.
```

Main must handle a rejected callback promise as appropriate for its scheduler.
This change supplies the async API; application integration is separate.

## Verification

```sh
node --test tests/hints-v1.test.js tests/engine.test.js tests/session.test.js
```

Tests use hand-authored fixtures and real engine/session operations. They cover
alternate valid layouts, fixed-placement preservation, swaps, staged repairs,
every legal partial layout of a three-person fixture, eight-person completion,
all supported rule types, invalid input, proven impossibility, hard bounded
search, shared-budget boundaries, timer responsiveness, cancellation during
search and repair, awaited scheduling, and snapshots across an await.
