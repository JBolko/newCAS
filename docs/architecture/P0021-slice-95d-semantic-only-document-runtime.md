# P0021 Slice 95d — engine-free semantic DocumentRuntime construction

**Status:** GREEN candidate (Node 24 and real Pyodide-browser acceptance outstanding).
**Base:** S94 checkpoint `296fbbe`, accepted S95a–S95c and their existing selected Worker/pilot contracts.
**Date:** 2026-10-18

## Problem

`DocumentRuntime` remains shared by the historical CASEngine path and the
new P0021 semantic document orchestration. Until S95d its constructor required
an engine-shaped object, even when callers only used the new selected
Semantic IR/Value/Worker pathway. S95b/C supplied a *throwing, unused dummy*
for this reason. That is an unnecessary migration coupling.

## Minimal decision

- `DocumentRuntime.createSemantic(documentId)` is an explicit factory for a
  semantic-only runtime. It uses the **same DocumentRuntime class**, same
  blocks, source authority, semantic DAG, revision checks and calculation
  projection. It owns **no legacy CASEngine** and uses no replacement engine.
- The ordinary `new DocumentRuntime(engine, documentId)` constructor remains
  unchanged for legacy callers, including rejection of `null`/`undefined`
  engines. A private factory token is not available to external constructors;
  an options lookalike does not bypass validation.
- For semantic-only documents `engine` is permanently `null` and nonwritable.
  The historical `calculate`, `getTaskState`, `resetTask`, `calculateBlock`,
  `recalculateDirty`, and `recalculateFrom` methods reject with the stable,
  test-level boundary error `LEGACY_ENGINE_UNAVAILABLE`. They do **not** fall
  back to another evaluator. In particular, historical calculation methods
  reject **before** setting `running` or modifying calculation state.
- The selected semantic orchestration methods already on DocumentRuntime are
  unchanged. The existing S95b/S95c pilot now uses `createSemantic` rather
  than a throwing legacy fake. It still uses the existing supervised Worker,
  attested IR, selected FunctionValue evaluator and actual Pyodide/SymPy.
- `LEGACY_ENGINE_UNAVAILABLE` is an internal migration boundary failure,
  **not** a newly specified P0009 user-facing mathematical diagnosis. Any
  future presentation/i18n mapping belongs in its existing owning layer.

## Not in this slice

- No changes to the active `src/js/main.js`, `CASEngine`, Python scope or
  release gate; these are still legacy until their own cutover is verified.
- No fresh evaluation scheduler, parallel document model, parser semantics or
  non-normative `.ncas` format.
- No general migration of all historical tests that deliberately exercise the
  legacy constructor. The older wrappers remain isolated until removed at a
  later migration checkpoint.
- The S95c test fixture remains exactly three test-only source blocks.

## Verification and exit

- RED before implementation: 10 of the new 12 tests fail because the factory
  and pilot wiring are absent; two older-constructor negative tests already
  succeed. This is **test-contract RED**, not a product regression.
- After implementation: 12/12 new tests pass. The focused regression also
  covers historical DocumentRuntime tests, S94e Worker recovery, S95a import
  audit, S95b/C browser contracts and prior active IR batch.
- Python regression remains 264/264 green in the reconstructed environment.
- The full local Node 22 suite is NOT a valid release acceptance: Peggy is
  missing and old CASEngine tests cancel independently on Node 22. Node 24
  full regression and actual S95b/S95c real-Pyodide browser acceptance are
  required on the developer's supported Windows toolchain.
- Browser entry: `tests/browser/p0021-slice-95b-selected-ui-pilot.html`.
  Re-run **Kør S95b-browseraccept** and **Kør S95c-browseraccept**; these now
  exercise the engine-free factory against a genuine Pyodide Worker.

Frozen architecture unchanged. This slice removes a constructor-level
migration dependency; it does **not** certify legacy retirement.
