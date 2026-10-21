# S97 review — S97a / S97b / S97c GREEN

Current final evidence and checkpoint proposal are in [S97_CLOSURE.md](S97_CLOSURE.md).
The earlier S97c API stop was resolved by explicit user approval. The approved
private writable storage / stable deeply read-only live-view solution is implemented.
The approved 32-path staged baseline is preserved; S97c.4 corrections are worktree-only.
No commit has occurred; HEAD remains 88a0a9b.

- Final full Node v24.11.0: **1501 PASS / 0 FAIL / 7 TODO / 1 SKIP** (1509 total).
- Focused S95–S97: **447 PASS / 0 FAIL / 0 TODO / 0 SKIP**; S97c.4 **30 PASS**.
- Full Python: **264 PASS / 0 FAIL**.
- Actual Chrome 155.0.8059.85/Pyodide/SymPy: **16 scenario PASS / 0 FAIL**.
- Parser source/AST sync and whitespace checks PASS; existing normative files unchanged.
- [ADR-0007 v1](../adr/ADR-0007-document-runtime-readonly-boundary-v1.md) is a draft,
  proposed for review only. It does not amend FROZEN or accepted ADRs.

## Staged-review corrections

R1 exposed insufficient immutable proof for Diagnostic-like frozen exotic data;
S97c.4 now requires acyclic frozen inert data before pass-through. Genuine Values
and Diagnostics retain identity/prototype; general validators are unchanged.
R2 found that three move-based setups pre-dirtied their targets. The cases now
re-prime success immediately before the isolated method and assert result/error,
generation and task isolation. The no-dirty mutant passes the old staged cases
but fails all three corrected cases. See current S97_CLOSURE.md supplement.
The prior staged review remains historical evidence, not the current acceptance.

## Consumer audit conclusions

This inventory was established before the API change. Runtime internals now use
private owned access. EditingSession, HistorySession and selected UI actions read
stable block views; they never acquire writable storage. Source transaction
candidate objects share an incarnation handle and become live only on successful
publication. Source tokens, mutation stamp, generation and host epoch remain separate.

Semantic evaluator `snapshot.blocks` references are detached semantic projections,
not runtime block arrays. Browser rendering reads the current block calculation.
Ten existing tracked test files plus the untracked S97a suite needed fixture
migration: seed through calculate/evaluate APIs, dirty through markBlockDirty,
structure through move/remove/insert. Tests use explicit data materialization
where native structuredClone cannot clone Proxy views. There is no private access
or production fixture writer. All previous non-TODO tests are green.

Runtime-owned graphs/maps/sets/listeners are protected, including nested iterator,
callback and reflection paths. Fresh derived analyses/batches remain detached.
Legacy engine state remains at its separate explicit boundary; semantic-only
runtime rejects it. Source persistence and mathematical semantics are unchanged.

The inventory below is lexical and intentionally also lists snapshot consumers;
it is a review aid, not a claim that every match formerly exposed authority.

## Consumer inventory (lexical, reproducible)

Command: `rg -l '\.(getBlock|getBlocks|blocks|addBlock|prepareBlock)\b' src tests`.
Snapshot references in this list are classified separately above; a lexical match
is not evidence of a writable runtime alias.

- `src/js/document-runtime.js`
- `src/js/editing/create-document-history-session.js`
- `src/js/editing/create-formula-editing-session.js`
- `src/js/editing/create-formula-structural-action.js`
- `src/js/semantics/classify-call-targets.js`
- `src/js/semantics/create-attested-ir-task-evaluator.js`
- `src/js/semantics/create-runtime-function-batch-evaluator.js`
- `src/js/semantics/create-source-function-definition-task-evaluator.js`
- `src/js/semantics/derive-source-semantic-snapshot.js`
- `src/js/semantics/evaluate-bound-source-function-call.js`
- `src/js/semantics/prepare-semantic-evaluation-batch.js`
- `src/js/semantics/project-semantic-dependency-analysis.js`
- `src/js/ui/create-semantic-calculate-action.js`
- `tests/browser/p0021-runtime-async-captures-worker-smoke.mjs`
- `tests/browser/p0021-slice-82-active-ir-acceptance.mjs`
- `tests/browser/p0021-slice-83-active-ir-worker.mjs`
- `tests/browser/p0021-slice-94e-document-recovery.mjs`
- `tests/browser/p0021-slice-95b-selected-ui-pilot.mjs`
- `tests/browser/p0021-slice-95c-test-fixture.mjs`
- `tests/browser/p0021-slice-95f-draft-structure.mjs`
- `tests/browser/p0021-slice-95f-dynamic-document.mjs`
- `tests/browser/p0021-slice-95f-test-fixture.mjs`
- `tests/browser/p0021-slice-96b2-history-enter.mjs`
- `tests/browser/p0021-slice-97a-history-mutation.mjs`
- `tests/js/p0020-call-target-candidates.test.mjs`
- `tests/js/p0020-derived-semantic-snapshot.test.mjs`
- `tests/js/p0020-derived-source-bindings.test.mjs`
- `tests/js/p0021-document-callable-dependencies.test.mjs`
- `tests/js/p0021-document-runtime-result-invalidation.test.mjs`
- `tests/js/p0021-ir-task-generation-stress.test.mjs`
- `tests/js/p0021-positional-function-redefinition.test.mjs`
- `tests/js/p0021-remove-earlier-function-definition.test.mjs`
- `tests/js/p0021-runtime-async-captures.test.mjs`
- `tests/js/p0021-runtime-async-structural-generation.test.mjs`
- `tests/js/p0021-runtime-composed-functions.test.mjs`
- `tests/js/p0021-runtime-function-batch-integration.test.mjs`
- `tests/js/p0021-runtime-function-captures.test.mjs`
- `tests/js/p0021-runtime-function-definition-writer.test.mjs`
- `tests/js/p0021-runtime-general-arithmetic-names.test.mjs`
- `tests/js/p0021-runtime-ir-batch-migration.test.mjs`
- `tests/js/p0021-runtime-multi-generation-captures.test.mjs`
- `tests/js/p0021-runtime-overlapping-generations.test.mjs`
- `tests/js/p0021-runtime-overlapping-task-scopes.test.mjs`
- `tests/js/p0021-runtime-selective-function-recomputation.test.mjs`
- `tests/js/p0021-runtime-semantic-dispatch.test.mjs`
- `tests/js/p0021-runtime-semantic-projection.test.mjs`
- `tests/js/p0021-runtime-semantic-reactive-invalidation.test.mjs`
- `tests/js/p0021-runtime-semantic-result-commit.test.mjs`
- `tests/js/p0021-runtime-stale-no-retry.test.mjs`
- `tests/js/p0021-runtime-structural-selective-recomputation.test.mjs`
- `tests/js/p0021-runtime-unified-call-dispatch.test.mjs`
- `tests/js/p0021-runtime-unified-expression-dispatch.test.mjs`
- `tests/js/p0021-runtime-variable-function-batch.test.mjs`
- `tests/js/p0021-semantic-auto-debounce-overlap.test.mjs`
- `tests/js/p0021-semantic-auto-debounce.test.mjs`
- `tests/js/p0021-semantic-auto-overlap.test.mjs`
- `tests/js/p0021-semantic-auto-scheduler.test.mjs`
- `tests/js/p0021-semantic-dependency-projection.test.mjs`
- `tests/js/p0021-slice-86a-document-source-boundary.test.mjs`
- `tests/js/p0021-slice-90a-statement-order-projection.test.mjs`
- `tests/js/p0021-slice-93c-function-composition-boundary.test.mjs`
- `tests/js/p0021-slice-93d-attested-function-composition.test.mjs`
- `tests/js/p0021-slice-93e-symbolic-binding-controls.test.mjs`
- `tests/js/p0021-slice-93f-symbolic-binding-former-red.test.mjs`
- `tests/js/p0021-slice-93f-symbolic-source-roles.test.mjs`
- `tests/js/p0021-slice-93g-attested-symbolic-occurrence-ir.test.mjs`
- `tests/js/p0021-slice-93h-symbolic-value-materialization.test.mjs`
- `tests/js/p0021-slice-94c-explicit-worker-recovery.test.mjs`
- `tests/js/p0021-slice-94d-worker-diagnostic-bridge.test.mjs`
- `tests/js/p0021-slice-94e-document-worker-recovery.test.mjs`
- `tests/js/p0021-slice-95c-file-fixture-pilot.test.mjs`
- `tests/js/p0021-slice-95d-engine-free-document-runtime.test.mjs`
- `tests/js/p0021-slice-95e-semantic-ui-calculate-action.test.mjs`
- `tests/js/p0021-slice-95f-variable-document-test-fixtures.test.mjs`
- `tests/js/p0021-slice-95i-formula-editing-session.test.mjs`
- `tests/js/p0021-slice-95j-formula-enter-action.test.mjs`
- `tests/js/p0021-slice-95k-dynamic-enter-browser-contract.test.mjs`
- `tests/js/p0021-slice-95l-formula-structural-action.test.mjs`
- `tests/js/p0021-slice-95m-real-browser-structural-contract.test.mjs`
- `tests/js/p0021-slice-95n-document-transaction.test.mjs`
- `tests/js/p0021-slice-95o-document-undo-redo.test.mjs`
- `tests/js/p0021-slice-95p-real-browser-undo-redo-contract.test.mjs`
- `tests/js/p0021-slice-96a-mutation-atomicity-red.test.mjs`
- `tests/js/p0021-slice-96a1-publication-guards.test.mjs`
- `tests/js/p0021-slice-96a2-atomic-calculate-batch.test.mjs`
- `tests/js/p0021-slice-96b-edit-history-red.test.mjs`
- `tests/js/p0021-slice-96b1-history-enter-contract.test.mjs`
- `tests/js/p0021-slice-96b2-ack-epoch-red.test.mjs`
- `tests/js/p0021-slice-97a-history-mutation-divergence-red.test.mjs`
- `tests/js/p0021-slice-97b-history-aware-actions.test.mjs`
- `tests/js/p0021-slice-97c-authority-encapsulation-red.test.mjs`
- `tests/js/test-document-runtime.mjs`
- `tests/pilot/01-binding-stress.test.mjs`
- `tests/pilot/02-front-door-robustness.test.mjs`
- `tests/pilot/lib/binding-cases.mjs`
- `tests/pilot/lib/fixtures.mjs`
- `tests/pilot/lib/fuzz.mjs`
- `tests/pilot/s86a-invalid-writer-normative.test.mjs`
