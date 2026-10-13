# newCAS — Current code gap audit (P0018/P0019 preflight)

**Date:** 2026-10-11
**Status:** REVIEW ONLY; no implementation and no new GREEN claim.
**Evidence:** `repomix-architecture(2).md`, `repomix-engine(2).md`, supplied after P0012 Slice 25; user's reported baseline 331 JS + 191 P0012 + 16 P0011 = 538 green.

## Verified observations

1. `docs/Grammatik.pegjs` parses any `Identifier(...)` as generic `FunctionCall`. Its lines 12–16 still claim the Python `cas_math/registry.py` is the authoritative function catalog. This claim is legacy, incompatible with the intended P0008 OperationSpec ownership. There is no need to enumerate tangentline/arclength in the grammar.
2. `src/js/operations/operation-spec.js` implements *schema construction and validation*, including `operationId`, `evaluatorId`, signatures, symbolic/scoped roles and purity. It is not, by itself, a populated operation catalog or source name-resolution mechanism.
3. `src/js/document-runtime.js` parses source and calls `engine.calculate(ast, taskKey)`; `src/js/cas-engine.js` transforms the AST into Python code via `Transformer.toPython` and invokes `run_in_task` in Pyodide. Thus the active document path is still legacy Python code execution, not P0010 resolved Value/Operation transport.
4. `src/python/core/executor.py` retains Python `task_registry` execution state, and `src/js/cas-engine.js` exposes `getTaskState`, `resetTask`, and global-context angle-mode rebuilding. These are migration targets: frozen architecture forbids Python task scope as authoritative document mathematics.
5. `src/python/cas_math/registry.py` populates the *legacy Python execution context*, including old `arclength`. It does not register newly selected P0012 `tangentline`/`surfacearea` handlers. Crucially, old and new `arclength` are different execution paths and should not silently be treated as one supported public operation.
6. The selected P0012 handler files (`scalar_tangentline.py`, `scalar_geometry.py`) require matched temporary evaluator IDs (`probe.symbolic.*`) and already resolved input Values. Adding their names to `cas_math/registry.py` is not a valid vertical integration of P0010/P0008.
7. `src/js/transformer.js` converts `FunctionCall` to a plain Python call. It also translates `FunctionDefinition` into Python `def`, whose global lookup on application conflicts with frozen document value capture semantics. Refactor only in bounded P0018/P0019 work; do not quietly change existing user behavior now.
8. `src/js/parser.mjs` is excluded from these snapshots. The grammar source is present, but exact generated-parser synchronization and direct parser behavior need verification during implementation.
9. `tests/python` are excluded from the two repomix snapshots. Full existing P0012 test fixture source cannot be audited here, even though the user ran them green.

## Consequences

- Do **not** add functions to the old Python registry to claim an architectural fix.
- Do **not** rewrite the entire DocumentRuntime in one change.
- Do **not** add operation-specific resolver branches for `diff`, `integrate`, `tangentline`.
- Introduce a small JS-side catalog that uses validated P0008 OperationSpecs; separately bridge selected evaluator IDs to existing P0012 Python handlers. Both catalog ownership and endpoint transport need explicit tests.
- Preserve P0006 semantic identity, P0007 resolved IR, P0010 transport, and P0009 diagnostics.

## Proposed first narrow RED slice

**Catalog-only tests, without browser/Python execution:**

- Find `tangentline` through generic public operation lookup; check stable operationId and matching selected evaluatorId.
- Check signature roles exactly: `value, symbolic, value`.
- Check `arclength` and *surface-of-revolution only* four-arg signatures: `value, symbolic, value, value`.
- Reject unknown operation spelling cleanly; preserve separate function/application semantics.
- Verify that catalog construction reuses `operationSpec` validation, never re-implements its schema.

Then a subsequent bounded vertical slice connects one chosen source expression to semantic IR and a P0010 request, rather than skipping resolution and presenting a selected Python handler as end-to-end integration.

## Deferred memo — retained, not forgotten

- Regression: choose initial models (linear, exponential, power, logarithmic; then nonlinear models deliberately); fitted function, coefficients, residuals, covariance/uncertainty, fit quality and predictions are distinct public result concerns. Defer backend capabilities not supported by SymPy to later NumPy/SciPy, without silently changing public semantics.
- Differential equations: defer pending proper FunctionValue and diagnostic/value support; no bare SymPy objects escape.
- Graph surface `z=f(x,y)`: distinct from surface of revolution; postpone double-integral domain syntax and formal public operation name.

## What to request before coding

For full confidence in integration tests, obtain current `tests/python` (or a full repomix test snapshot), and the generated `src/js/parser.mjs` or a reproducible grammar-build command. Source grammar is sufficient for the catalog-only slice but not for falsely claiming a complete source-to-evaluator proof.
