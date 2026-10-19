# P0021 Slice 95h — student UI event/authority boundary audit

**Date:** 2026-10-19
**Status:** Audit-only; no student UI cutover, no mathematical implementation changes.

## Scope and normative boundary

The frozen architecture requires persistent document block/task IDs, editing buffers
owned by an EditingSession, and authoritative source changes only upon commit.
DocumentRuntime owns semantic bindings, dependency invalidation, generation and
calculation state. The evaluation/Worker boundary never owns UI event semantics.
The existing UI action (S95e) and shared renderer (S95g) are useful, but do not
by themselves satisfy the frozen *student* document and editing contracts.

## Evidence from `src/js/main.js`

| Observed current behavior | Missing migration proof |
|---|---|
| `keydown` Enter → `evaluateCell(.cell)` → `engine.calculate(ast, taskId)` | Per-cell action must be reconciled with task-ordered dependency calculation and generation/revision guards |
| `inputField.value.trim()` read directly from DOM | No EditingSession-driven buffer/transaction boundary in this UI route |
| `assignment?.id ?? 'default'` | HTML element ID is not a verified persistent task mathematical scope identity |
| `document.querySelectorAll('.cell').length + 1` → `cell-N` | Count-derived ID can collide after removal/other structural edits; not a persistent document block ID |
| `new CASEngine(new Transformer(settings))` | Live student UI still executes legacy; S95f/g browser pilot is a *different* UI route |
| Error details interpolated into `innerHTML` | Separate unsafe legacy presentation pattern; must be hardened in later UI work |

The old UI renderer has a selected Semantic Value entrypoint after S95g,
but the live Enter/cell coordinator still uses the legacy evaluator.
No active `main.js`, parser, Python, DocumentRuntime or frozen contract file is modified here.

## Decision: is a direct 95i cutover unproblematic?

**No.** It would be premature to connect Enter directly to the S95e
`createSemanticCalculateAction` while the UI lacks stable model-authoritative
block/task identity and a defined editor commit contract. That could create
competing authority between DOM and DocumentRuntime, accidentally cross tasks,
or invalidate/commit stale outcomes.

### Exact prerequisites before cutover

1. Decide/make explicit the existing UI's mapping to immutable block IDs and task IDs. The UI must not allocate identity from DOM counts.
2. Establish the actual EditingSession buffer → authoritative source commit boundary. Respect unfinished expressions.
3. Specify Enter as one *user action* with task-aware, revision-guarded scheduling; decide which blocks become dirty/eligible, without replacing the existing scheduler.
4. Verify add/remove/move/duplicate identities against ADR-0006 and the frozen structural-edit cases.
5. Ensure only one authoritative document source and one calculation status path. Continue using `DocumentRuntime`, S95e action and the existing renderer, not a new adapter layer that owns state.
6. Browser acceptance must include at least two separate tasks, a structural edit and a pending Worker result. Keep student release blocked until proven.

A follow-up **S95i should first establish these contracts and their regression
fixtures**, not secretly bypass them to achieve an early UI cutover. This
is a readiness gate, not a new layer or an attempt to implement EditingSession.

## Scope of automatic evidence

The source auditor performs bounded textual probes and the existing S95a
static import-graph walk. It does *not* execute `index.html`, infer dynamic
JavaScript behavior, prove actual task membership of every DOM element, or
establish that all browser entrypoints are wired correctly. The browser pilots
remain separate functional evidence.

## Verification

- Run `node --test tests/js/p0021-slice-95h-student-ui-event-boundary-audit.test.mjs`.
- Run `node tools/analyze/p0021-s95h-student-ui-event-audit.mjs` to inspect the report.
- On the developer's Node 24 machine run the bundled verifier with all JS/Python tests.
- No new browser test is required: *no live browser code or evaluator code changed*.
