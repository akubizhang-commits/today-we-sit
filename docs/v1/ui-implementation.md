# v1 Canvas UI implementation

Implemented 2026-09-15 against docs/06-v1-release-requirements.md and docs/07-v1-development-architecture.md.

## Ownership

This change owns only `src/ui/*`, `tests/layout.test.js`, `tests/ui-v1.test.js`, and this document. No app, engine, content, platform, build, or existing regression test changes are part of the UI work. No commits were made.

## Rendering and layout

`render(ctx, app)` returns `{id, x, y, w, h, action, payload}` hit targets. Every frame produces deterministic semantic IDs and fresh rectangles. Rendering does not mutate application state or read progress placement wrappers; `app.session.placement` is authoritative.

`computeLayout({width, height, insets, waitingCount, expandedRules})` returns:

- `viewport`: centered, at most 430 CSS pixels wide; desktop gutters are painted separately.
- `safe`: viewport with top/bottom/left/right platform insets removed.
- `header`, `rules`, `board`, `waiting`, `toolbar`: separate play regions.
- `body`, `pageBody`, `footer`, `overlay`: navigation and reading regions.
- `waitingColumns`, `waitingCapacity`, and `scrollRanges.waiting`: bounded candidate paging geometry.

All coordinates are CSS pixels. The caller sets DPR on the context once; it must not apply reference-canvas scaling, translation, or pointer-coordinate rescaling. The renderer never scales the complete 844px design. Small local transforms inside character/icon illustration primitives are independent of UI geometry.

Headers stay 48px high. The play toolbar has two 48px button rows. Short screens reduce gaps and the preference summary height, preserving seat targets. Tall screens show two waiting rows; short screens show one. Candidate navigation advances through the entire waiting list using `waitingOffset`; it clamps safely after placement or resize. `seatRegions(layout, seats)` ranks actual x/y coordinates, preserves sparse layouts, caps oversized cards, and returns one nonoverlapping target per seat. Adjacency links are drawn behind seat cards.

Tested viewport sizes include 320, 360, 375, 390, 414, 430 and desktop widths, heights 568 through 932, asymmetric desktop insets, and 320×568 with top 48/bottom 34 safe areas. Touch targets are at least 44×44; buttons are at least 48px high. Main text uses 14–16px, larger headings, and auxiliary labels at least 12px.

## Files

| File | Responsibility |
| --- | --- |
| `src/ui/renderer.js` | Frame, viewport, page dispatch, top layer |
| `src/ui/layout.js` | CSS-pixel screen areas and seat regions |
| `src/ui/components.js` | Measured text wrapping, semantic buttons, pagination, icons |
| `src/ui/pages.js` | Home, chapters, play, daily, album, settings |
| `src/ui/overlays.js` | Help page; complete rules, privacy, result, reset, delete and toast layers |
| `src/ui/scenes.js` | Original bus, garden, cinema illustration and seat environment objects |
| `src/ui/draw.js` | Drawing primitives and twelve original character silhouette variations |

There are no new runtime dependencies or downloaded assets. Bus window panes, door, seats; garden table, dishes, foliage, lanterns; cinema screen, speakers and chairs are locally authored Canvas geometry. The cream, forest and terracotta palette remains consistent. Decorative home/album illustrations are separate from the puzzle board. On the puzzle board, windows, doors, shade, serving objects, lanterns and speakers are attached only to seats that actually have those tags.

## Pages and state

- Home counts unique completed campaign IDs against `app.levels.length`; it uses `app.chapters.length` and displays `statusNote` when provided.
- Chapters show ten levels per page, stable start IDs, catalog display numbers, and completed/unlocked/locked states. Three chapter tabs emit numeric indices.
- Play shows the selected person or current tutorial instruction, empty seat labels, environmental features, result status marks, candidate paging, undo/reset, move/unseat, and separate free rule explanation and advanced hint buttons.
- Daily uses `dailyView` availability, day key, replay and completion state. It displays classic-review and replay language without inventing a reward or online service.
- Album uses the supplied twelve milestone cards, two per page, original scene postcards, milestone requirements and distinct locked/claimable/claimed states.
- Settings emits the persisted music/effects/vibration/reducedMotion keys and displays actual `serviceStatus.cloud` and `.ads` values. It does not advertise configured cloud backup or working ads when absent.
- Help provides a paged rule manual, including explicit move/swap, undo, environment, six rule families and voluntary hints.

Advanced hints use `app.hintLabel`; `app.hintBusy` removes the active advanced-hint target. Free explanation always remains a separate `hint` target. Result rendering distinguishes daily, chapter boundary, final campaign entry and ordinary continuation without ID arithmetic. Actual unlocks, payments, entitlements, progress, initialization and tutorial advancement stay in the app.

## Complete text and top layers

The preference summary opens a reading panel. The panel lists the selected person first, then every person and every full rule, current tutorial/status information, a complete numbered seat glossary, and explicit adjacency pairs. No rules are sliced or ellipsized. Measuring text before pagination makes even four unusually long rules reachable. Full text remains available for seat tags not repeated in the compact board labels.

Help/privacy/long toast content uses the same reader. Each reader has previous/next controls, a page indicator and an explicit close button. A toast, modal, expanded preference panel or result clears all lower-layer hit targets. A short toast has one dismiss target covering the safe region, so it cannot select an obscured person. Modal gaps do not allow clicks to reach the board.

## Main integration details

The original requested action list is preserved, with one already-present app extension for local deletion:

1. **All pagers emit `pagePrev` / `pageNext` with `{pageCount}`.** The app should use this count to bound `app.levelPage`, including on album/help and while a rules/privacy modal or long toast is open. Process pager actions before a generic modal guard. A fallback chapter count is appropriate only when payload is absent. Album uses two cards per page and the same `levelPage`; it does not use `albumPage` or `albumNext/albumPrev`.
2. Reset `levelPage` on chapter/page changes, level start, person selection, opening/closing requirements, opening privacy/help, and starting a new explanatory toast. The count is measured by the UI, so the app must not cap every page to the chapter's three pages. The renderer clamps stale offsets without changing state.
3. The live main implementation introduced **`modal='deleteLocal'` and `confirmDeleteLocal`**. The UI supports both and offers `cancelModal`, clearly distinguishing irreversible local clearing from reset and from cloud deletion.
4. Waiting navigation uses existing `waitingPrev` / `waitingNext` and `waitingOffset`. The UI displays the correct capacity at each viewport. It does not need new scroll or drag APIs; every item is accessible through explicit paging controls.
5. App input must use the returned CSS-pixel rectangles, clear interrupted drags, and route only exposed targets. UI illustration has no independent input side effects.

During implementation the main owner incorporated the `{pageCount}` pager payload and deletion contract. App/UI end-to-end routing should remain in main's integration coverage; these files do not change app state handling.

## Verification

Tests were written and run before implementation: initial failures included the missing layout module, repeated/missing hit IDs, fixed 390px bounds, nonpaginated chapters and absent layers.

Final UI command:

```sh
node --test tests/layout.test.js tests/ui-v1.test.js
```

Result: **96 tests passed, zero failed**. Coverage includes every authored region in the current 124-level authoring corpus at phone sizes, sparse/4×3 coordinates, all seven pages, large safe areas, stable targets, minimum target size, pairwise hit occlusion, all candidates reachable, ten-level paging, all long-rule endings accessible, full seat glossary, exclusive modal hits, authoritative session placements, state immutability, readable font sizes and page text bounds.

Visual QA used actual Canvas rasterization with a system CJK font: both 320×568 and 390×844 versions of all pages, dense play, complete rules and delete confirmation. PNGs were temporary QA artifacts, not shipped assets. Local source geometry was inspected after rendering. The UI has not been claimed as real-device, screen-reader, performance, WeChat release or production-service acceptance.

The full shared test suite was also run during parallel integration. At the latest recorded run it had 270 passing / 9 failing tests; failures were existing numeric-ID/synchronous-initialization assumptions in `tests/app.test.js` and `tests/renderer.test.js` after main moved to stable IDs and async initialization. Those files are outside this change's ownership. The dedicated stable-ID UI suite is green; the main owner is responsible for updating those integration regressions.


Integration closure (2026-09-15): main updated legacy numeric/synchronous tests, integrated pagers and daily resume actions, and completed the full suite at 367/367 passing. The earlier 270/9 result above is historical. Actual browser spot checks are recorded in progress.md.
