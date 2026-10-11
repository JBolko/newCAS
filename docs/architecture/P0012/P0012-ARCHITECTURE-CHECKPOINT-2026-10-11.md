# newCAS — P0012 architecture checkpoint

**Date:** 2026-10-11
**Status:** CHECKPOINT / GREEN for tested slices; **P0012 and the evaluator phase are NOT closed**.
**Basis:** inspected the Python evaluator files and tests in the local Slice 21 reconstruction, `ROADMAP_AKTUEL.md`, the P0005 Value contract and accepted set extension, and the reported Windows tests. No production changes in this checkpoint.

## Evidence / exact scope

- User's latest run: **331/331 JavaScript**, **150/150 P0012 Python**, **16/16 newer P0011 Python** = **497 passing tests in these three suites**. The older consolidated 29 P0011 core tests, pinned Pyodide rerun, and full DocumentRuntime integration are **not included** in this latest figure.
- Functions/handlers covered in these P0012 slices: selected addition, multiplication, power; `sin`, `cos`, `tan` with explicit angle semantics; `exp`, natural logarithm and decimal logarithm; first-order `diff`; equality `solve` over R or C; finite isolated real system solutions; supported real inequalities with finite, unbounded and union intervals.
- The tests are evidence of the tested contract surface, **not an assertion of complete SymPy capabilities** or arbitrary-expression termination.

## Architecture boundary reviewed

`DocumentRuntime` (future authoritative state/selection) -> **P0010 EvaluationRequest** + already selected **P0008 OperationSpec** -> **P0012 selected handler / contract checks** -> **P0011 SymPyValueAdapter** (disposable identity mapping) -> SymPy -> P0011 public Values -> **P0010 EvaluationOutcome**. No public Value may contain a live backend object.

### Working well

1. **Exact vs approximate representation:** rational exponent, `precisionBits`, no silent approximation, explicit DEG/RAD and real/complex choices at evaluation boundary.
2. **Identity fidelity:** free symbols of identical display spelling remain distinguishable; diff target and solve targets are selected symbol references.
3. **Result typing:** `RelationValue` inputs, `SetValue` and `VectorValue` outputs, bounded and unbounded intervals and unions; no illicit SymPy object leakage.
4. **Common contracts:** `_binary_expression_contract.py`, `_unary_value_contract.py`, and `_trigonometric_argument.py` express actual shared responsibilities. Ordinary operations have explicit mathematical kernels.
5. **P0005 addendum:** unbounded interval endpoints are bound markers, not numeric infinities; union is a SetValue. The `precisionBits` regression is now guarded by cross-contract JS tests.

### Concrete technical debt / risks (prioritized)

**A. Contract validation ownership:** `scalar_differentiation.py`, `scalar_solving.py`, `system_solving.py`, `scalar_inequalities.py` repeat request/version/spec/evaluator/arity/role checks. Extract *the shared selected-handler boundary* rather than requiring all operations to share one input shape. Do not introduce a second registry or let `operationId` select a backend handler.

**B. Diagnostic taxonomy:** handlers emit `undefined-result` for trig/log domain failures; check that it is **actually in normative P0009**. Several handlers use `unsupported-operation` for inability to represent a result, unsupported domains or missing mathematical solutions. These must be distinguished from the mathematically valid empty set. Programmer/integration errors may deliberately raise `ValueError` but user mathematics must not leak raw backend exceptions.

**C. Execution safety:** simple `tan(x)=x` returned unsupported on the tested path, but SymPy solving can be expensive. A user-facing evaluator requires bounded execution/cancellation at the runtime boundary, not merely exception handling or a time check after computation. Do not promise universal termination.

**D. Domain semantics:** current equality solver accepts `{}` as legacy real default and explicit `{domain:'real'|'complex'}`. Trigonometric functions require an explicit `{angleUnit:'deg'|'rad'}`; the document default DEG is not yet wired end-to-end. Complex comparisons must not be ordered; `abs(z)>8` is meaningful only because `abs(z)` is real.

**E. Value expressiveness:** ConditionSet/ImageSet, general free-parameter systems, union normalization/equality, function identities and derivatives of unbound functions, richer scalars and result collections require scoped work. Do not encode math as display strings or silently coerce to finite sets.

**F. Public operation catalog:** fixture handler IDs `probe.*` remain provisional. A consolidated OperationSpec catalog and selection/integration test have not been demonstrated here.

**G. Tooling / provenance:** P0012's many RED-named tests are now regression tests; retain assertions, consolidate carefully. Delivery ZIP files stay out of Git; use a tracked checkpoint note and permanent tests. The `value.js` overwrite regression demonstrates why current-file diffs and full JS suites matter.

## Requested calculus/statistics capabilities: where they belong

| Requested capability | Mathematical route / first scoped test | Architectural owner / watchpoint |
|---|---|---|
| `integral` | Indefinite `integrate(x^2,x)` then definite `integrate(x^2,(x,0,1))=1/3` | **P0014 symbolic operations**; variable role, bounds signatures, integration constant policy and unrepresentable results |
| `tangentline` | Point-slope line from `f(a)` and `diff(f,x)` at `a`; test tangent for `x^2` at `x=2` | Derived operation over Value functions/expressions, **P0013/P0014** boundary and defined output (`RelationValue` vs expression) |
| `arclength` | `∫_a^b sqrt(1+(f'(x))^2) dx`, then numerical mode when exact integration unavailable | Composite calculus operation; variable/bounds, branch/reality assumptions and exact-vs-numeric policies |
| `surfacearea` | Start with **explicit** surface-of-revolution convention, e.g. around x-axis `2*pi*∫_a^b abs(f(x))*sqrt(1+f'(x)^2) dx` | Needs axis/geometry/interval policy, self-intersection and sign choices; **later than arclength** |
| Regression | Simple linear least-squares with modest datasets first; compare known coefficient fixtures and residual semantics | **P0017**, already allocated in roadmap; SymPy is reasonable to *probe* initially, but numerical stability, precision, speed and fit-result public shape must be tested; NumPy not ruled out by dataset size alone |
| `dsolve` | First-order separable/linear ODE with initial-value conditions later | **P0014 / P0013**: unknown FunctionValue, derivative representations, arbitrary constants, solution family; deliberately defer |
| General `f(g(x))` symbolic diff | Chain/product rules for undefined `f` and `g` | Function identity and derivative-expression transport; separately scoped extension beyond known standard functions |

**Important:** The existing roadmap names **P0012 “Core scalar/expression operations,” P0013 “FunctionValue evaluation,” P0014 “Symbolic operations” (diff/integral/sum/solve/limit), P0015 containers/matrices and P0017 statistics/regression**. Several P0014-like capabilities were explored early as pressure tests while working on P0012. That **does not imply P0014 is completed** or should be silently reclassified into P0012. Preserve the ownership boundaries and record cross-phase evidence.

## Suggested work order

1. **Checkpoint acceptance now:** commit known-good code/tests, accepted P0005 addendum, P0011 complex adapter addendum, and this audit; exclude ZIPs and temporary logs. No automatic destructive cleanup.
2. **One narrow quality slice:** review P0009 diagnostic code list and make selected-operation validation more consistent *without altering mathematics*. Require the same full JS/P0012/P0011 test baseline; add tests for bad backend results and unsupported cases where appropriate.
3. **Integral probe:** decide exact indefinite/definite result semantics and unknown anti-derivative policy, including an integration constant only when it fits the selected operation's contract.
4. **Tangent line and arc length:** reuse differentiation and integration under explicit output/bounds conventions; do not special-case derivation in the UI.
5. **Regression as P0017** with representative small and ill-conditioned datasets and a public structured result proposal; select numerical backend based on evidence.
6. **Surface area and dsolve later**, after FunctionValue/symbolic operator foundations are stronger. Parallel future work: user-visible indexing/conversion of unordered finite solve sets into ordered solution lists.

## Checkpoint acceptance

This checkpoint documents proven behavior and gaps; it is **not a release certification**. Verify the real repo's `git status`, diff, pinned runtime compatibility and test discovery before any cleanup/commit. Maintain frozen core architecture and add versioned, evidence-backed contract supplements only as needed.
