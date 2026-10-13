# newCAS — architecture integration review (initial)

**Date:** 2026-10-11  
**Status:** REVIEW / planning, not an implementation or green test  
**Observed user baseline:** 331 JavaScript, 191 P0012 Python, 16 recent P0011 Python = 538 tests GREEN.

## Evidence and authority

1. Frozen `ARCHITECTURE_SPECIFICATION_FROZEN_v1.0` and stress tests remain normative.
2. P0008 OperationSpec defines operationId, evaluatorId, signatures, roles value/symbolic/scoped, and purity.
3. P0005–P0011 describe public Values, identities, semantic IR, diagnostics, transport, and SymPy adapter.
4. The repository `repomix-engine(1).md` snapshot is **historical**, not proof of the current checkout. It shows `docs/Grammatik.pegjs`, `src/js/transformer.js`, `src/python/cas_math/registry.py`, `src/python/core/context.py`, `src/python/core/executor.py`, and `src/js/cas-engine.js`.
5. The recent P0012 green slices were tested through a selected Python evaluation boundary. Full current parser -> runtime -> evaluator wiring has NOT yet been demonstrated.

## Initial assessment

- Retain the parser as a syntactic component; ordinary function-call syntax should not hardcode a case for each mathematical operation.
- Use P0008 OperationSpec for *public operation semantics*. The legacy Python registry was a backend execution context registry, not a substitute for OperationSpec.
- Preserve operationId/evaluatorId separation. Do not infer resolved semantics from a Python function name or let the backend resolve document names.
- The symbolic-target resolution of `diff`, `integrate`, `solve`, and `tangentline` requires generic handling of OperationSpec role metadata in semantic resolution.
- Public FunctionValue application and public operations are separate concepts; `f(x)` can refer to a document-defined function, whereas `sin(x)` could refer to a built-in operation, under explicitly specified name-resolution policy.
- The evaluator must receive already-resolved Values and operation metadata; no task IDs, block order, history, or dependency state.
- The source grammar for `y=tangentline(...)` must preserve whether `=` is relation formation, while `:=` means definition; this is a language-semantic question, not math-handler behavior.
- No direct production-code change until a fresh repo inventory and a single narrow end-to-end RED acceptance case establish what is already wired.

## Proposed narrow verification order

1. Read the **current checkout**: grammar, AST/transformer, OperationSpec catalog, semantic-resolution modules, evaluation dispatch, DocumentRuntime, Value + diagnostic transports, and tests. Compare against P0008 and frozen documents.
2. Inventory public operations including `arclength` and revolution-surface-area; check missing catalog entries, aliases and intended function-call signatures without implementing them yet.
3. Write one RED end-to-end fixture: source expression `tangentline(x^2,x,2)` -> AST -> OperationSpec -> semantic identities -> P0010 request -> P0012 result ExpressionValue `4*x-4`. No fake end-to-end tests that skip layers.
4. Make only the minimum safe wiring change, rerun 331+191+16 test baseline and new tests.
5. Add binder and materialization pressure: `x:=17; diff(x^2,x)` vs `x:=17; A:=x^2; diff(A,x)`, and `integrate(3*x^2,x,1,x)+2`.

## Deferred memo: retained scope, not forgotten

**Differential equations:** parked until FunctionValue, symbolic operation and result-transport requirements are settled. Record supported classes before implementation. Do not expose a raw SymPy return type as public Value.

**Regression:** parked until public result semantics are chosen. Candidate outputs include fitted model/FunctionValue, estimates, residuals, covariance, uncertainty/statistics and goodness-of-fit; these cannot silently become a plain ExpressionValue. Select initial model family and output schema explicitly. Use SymPy where the declared algorithm is supported; defer unsupported numerical fitting paths for later NumPy/SciPy integration, using the same public semantics independently of backend. Do not promise SymPy can fit every model.

**Surface area z=f(x,y):** deferred until explicit integration-domain syntax and double-integral behavior; distinguish it from previously tested surface of revolution about x-axis. Consider renaming existing public operation rather than changing its meaning silently.

## Stop conditions

If current implementation requires Python-owned document state, operation-name-specific resolver semantics for every new function, public SymPy objects, ambiguous free/bound symbol identities, or non-transportable results, stop and reconcile the contract before adding another operation.
