# v1 content production

Status: authored and automatically checked; manual phone acceptance and blind difficulty testing remain **pending for all 124 puzzles**. This document does not grant public-release approval. The local visual editor, renderer, catalog integration and main bundler are owned separately.

## Sources and identity

- `content/authoring/levels.json`: authoritative editable array of 124 complete puzzles, including reference placements and individual design intentions.
- `content/manifest.json`: schema 1 / content 1.0.0; 90 campaign IDs, 14 daily IDs and 20 reserve IDs. Chapter order is bus, garden, cinema. The daily cycle anchor is `2026-09-15` (Asia/Shanghai scheduling is a separate feature).
- `content/authoring/legacy.json`: offline snapshot of the existing 30 original puzzles, with stable IDs and author metadata added. Original titles, introductions, numeric chapters, seats, adjacency, people (including IDs, names, colors and rules) and references are preserved exactly. Old 1–10 map to bus-001–010, 11–20 to garden-001–010, 21–30 to cinema-001–010. Catalog migration remains the main owner's responsibility.
- `content/authoring/design-cards.txt`: 94 individually specified additions: 60 campaign, 14 independent daily, 20 reserve. Each card explicitly specifies its layout, occupancy, rule graph, difficulty and reasoning intention. It does not generate random constraints or rename campaign puzzles into daily puzzles.
- `content/authoring/compose.js`: optional offline expansion of the design cards and legacy snapshot. It expands geometry, stable cast references and Chinese rule prose. It is never a runtime dependency.

All additional puzzle arrangements, titles and reasoning intentions were written for this project. There are no remote content sources, purchased puzzle packs or dependencies in this pipeline. Legacy content originates from this repository's original `src/content/levels.js`; its reuse is not a claim about the rights of any separately supplied art/audio assets.

The new puzzles consistently reuse twelve characters: 小满、阿穗、阿陶、圆圆、小岚、青禾、阿榆、林叔、阿杏、小游、苏苏、安姨. Character IDs and colors remain constant across the new content. Legacy casts are deliberately retained; this does not claim that all legacy portraits have already been mapped to twelve finished visual assets.

## Authoring conventions

Every level has `revision: 1`, `chapterId`, numeric `chapter`, `kind`, `difficulty`, `title`, `intro`, `seats`, `adjacency`, `people`, `reference`, `designIntent` and pending phone-QA status. The 90 campaign difficulty labels are author targets: **36 easy, 40 normal, 14 challenge**. They are not observed completion-time measurements. Daily/reserve difficulty is recorded separately.

There are ten new geometric templates, with row lengths:

| Template | Row lengths | Scene use |
| --- | --- | --- |
| A | 3, 3 | Bus / garden |
| B | 2, 3, 2 | Bus |
| C | 4, 3 | Garden |
| D | 3, 4 | Garden / cinema |
| E | 4, 4 | Cinema |
| F | 2, 4 | Bus |
| G | 3, 2 | Cinema |
| H | 4, 2, 2 | Cinema |
| I | 2, 2, 3 | Bus |
| J | 3, 3, 3 | Garden |

Each scene uses four template variants. These are logical layouts, not a claim that four scene-art/time-of-day variants have been produced. Boards use at most four columns, three rows and eight people. Nine-seat boards deliberately leave space. All rows start at x=0; x/y are integer logical coordinates. Only immediately neighboring seats in the same row are adjacent. There are no invisible vertical links or skipped-seat links.

The Chinese introductions explain variable row lengths and physical label locations. Bus windows are each row's leftmost seats and the door is the front row's rightmost seat. Garden shade/serving labels mark each row's left/right ends; the lantern is the second row's second seat. Cinema speakers mark each row's right end; shade covers the first two seats of the second row only. Third-row cinema seats do not inherit shade. Rendered assets must follow these tags.

Design cards use one line per puzzle:

```text
id|chapterId|difficulty|template|title|reference seat numbers|person rule groups|designIntent
```

Semicolons separate people; spaces separate rules. `+2` means adjacent to the second person, `!2` means apart from them, `*` requires an empty horizontal neighbor, `@back` means a zone, `-window` excludes a tag, and `window` requires a tag. The reference positions are explicitly authored, not generated solver answers. Examples of actual reasoning differences include shared versus separate empty neighbors, short-row capacity excluding a long chain, opposite directions for adjacent groups, double-adjacency forcing an interior seat, and third-row placement distinguished from repeated scene zones.

Edit `levels.json` directly (including through an external editor) and validate it. If intentionally editing design cards instead, run:

```sh
node content/authoring/compose.js
```

**Composition replaces levels.json and manifest.json**, including any changes made only in the editable JSON. It is an optional source-regeneration operation, not a normal build step. The build always reads the JSON. Keep card and JSON changes together when using this regeneration workflow. The frozen legacy snapshot is not an invitation to redesign migrated puzzles.

## Validation

```sh
node scripts/validate-content.js --release
node --test tests/content-release.test.js tests/levels.test.js tests/engine.test.js
```

Programmatic API:

```js
const { validateContent } = require('./scripts/validate-content');
const { ok, errors, report } = validateContent(levels, manifest, {
  release: true,
  nodeBudget: 20000
});
```

`errors` contains `{code, message, levelId?}` records. `report` includes group counts, campaign difficulty distribution, per-level search results and `manualPhoneQA: 'pending'`. The CLI prints JSON, exits 0 only on success, exits 1 for invalid data/input and supports `--root directory`. Unknown options fail instead of silently weakening validation. Without `release: true` / `--release`, small development catalogs are allowed; schema, references, geometry, rules and solvability are still checked.

Checks include manifest membership/order/counts, duplicate IDs, chapter identity, revision, metadata, people/seat limits, unique coordinates, actual scene tags and zones, complete horizontal adjacency, rule targets and reference legality. Structural duplicate detection ignores names, colors, prose, references, array order and ID spelling. It compares geometry, actual unary allowed-seat domains, empty-neighbor needs and a canonical undirected relation graph. Thus equivalent conditions such as an alternate tag expression with the same legal seat set cannot disguise a copied puzzle. This is structural equivalence, not an exhaustive proof of equivalence of every possible implication or a judgment of fun.

Counting uses the real engine's `evaluate` for candidate placements. Each level gets at most 20,000 candidate evaluations by default. Search stops after two solutions; `solutionCount: 2`, `solutionCountCapped: true`, `searchStatus: 'multiple'` means **at least two**, not exactly two. An exhaustive count of one establishes uniqueness. A budget interruption is `budgetExceeded` and fails validation, even when the supplied reference is valid. No answer or uniqueness claim is invented on a timeout. Graph canonicalization considers at most 8! cheap encodings; it does not repeatedly enumerate 8! engine solutions.

The tests separately call the real engine's `solve` on all 124 puzzles, evaluate every reference and returned solution, and follow `getHint` from an empty board to completion in at most one seating move per person. They reject repeated forward states. This verifies the forward hint path; it does not claim exhaustive repair-path testing for every possible wrong arrangement. General repair behavior belongs to engine/hint tests.

## Runtime build contract

```js
const { buildContent } = require('./scripts/build-content');
const result = buildContent({ root: projectRoot, mode: 'production' });
// result: { levelCount, contentVersion, files: {levels, manifest}, report }
```

CLI equivalent (writes generated runtime files):

```sh
node scripts/build-content.js --mode production
```

Default mode is `production`; accepted modes are `production` and `development`. Both publish only campaign and daily content. Production requires the full release gate; development permits a small validated catalog. Invalid source is rejected before either output file is written. Call the build before the main bundler; no package/build/catalog changes are made by this content work.

Outputs:

- `src/content/runtime/levels.js`: CommonJS `{ levels: [...] }`, ordered by campaign then daily manifest order, 104 puzzles in v1.
- `src/content/runtime/manifest.js`: CommonJS manifest object directly, with no reserve key or IDs.

Nested allowlists omit reference, designIntent, QA records, design cards and other author-only fields. Reserve levels and reserve manifest membership are entirely excluded in both modes. The runtime module can be used with `createCatalog(require('./runtime/manifest'), require('./runtime/levels').levels)`. Neither runtime file imports authoring content or requires an author reference to solve.

Tests perform deterministic builds in disposable temporary roots, inspect the emitted CommonJS modules, check omission of author fields/reserves, and confirm invalid source does not overwrite a previous valid output. This task does not generate or modify runtime files in the shared project checkout; the main owner can invoke the build during integration.

## Remaining acceptance

For each puzzle, a human must play on phone-sized layouts and actual devices, check that seat tags match visible objects, that Chinese rules name the right people, and that alternate solutions are accepted. Record device/build, reviewer/date, observations, completion time and any revision as real evidence. Blind player timing may require difficulty reclassification and another aggregate review. Phone acceptance, fun, accessibility, asset licensing and platform readiness cannot be inferred from solver success. In particular, the 20 reserve puzzles are authored and automatically valid, but are **not yet manually accepted release inventory**.
