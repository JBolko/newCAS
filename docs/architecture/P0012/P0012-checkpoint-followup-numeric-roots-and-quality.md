# P0012 checkpoint follow-up — bounded roots and evaluation safety

Date: 2026-10-11. Status: design/quality note, **no production changes**.

## Bounded transcendental equations

`tan(x)=x`, `0 <= x <= 4*pi`, in **radians**, has four real roots to 12 decimal places:

- `0`
- `4.493409457909`
- `7.725251836938`
- `10.904121659429`

The last three are numeric approximations, **not exact symbolic solutions**. Computed independently using a bounded bracketing root solver on continuous branches. Tangent has poles at `pi/2 + k*pi` inside this interval; a numerical solver must partition the interval at these poles and must not search across discontinuities. At `x=0`, evaluate the exact endpoint explicitly. A sign-change sampler alone is not a completeness guarantee for general equations; multiple/tangent roots and tightly clustered roots may be missed.

The current P0012 `solve` intentionally returns an unsupported result when SymPy returns an implicit solution family such as a `ConditionSet`. The example does **not** justify changing ordinary exact `solve` into an uncontrolled numerical fallback. A *separately selected* bounded-numeric-root operation is recommended, with explicit domain, bounds, accuracy/tolerance, root ordering and a diagnostic for incomplete coverage. It should never claim exhaustive results based only on sampling.

## Contract checkpoint

The current evaluator handlers still repeat request/spec envelope checks (especially symbolic handlers); avoid a large refactor before specifying one *shared* preselected operation-validation boundary that also supports `symbolic` argument roles. The handlers retain their own mathematical checks and return structures. No registry or document-state access in evaluator.

Review and explicitly accept every diagnostic code against P0009. Current code has `wrong-arity`, `type-mismatch`, `unsupported-operation` and `undefined-result` call sites. `undefined-result` merits specific P0009 review; do not silently expand the frozen diagnostic-code vocabulary. Distinguish unsupported mathematical result vs invalid numeric domain vs internal configuration misuse.

For resource safety, timeouts for long-running SymPy work need cancellation at the worker/process runtime boundary. A Python `try/except` is not a timeout and must not be presented as one. Avoid running unbounded symbolic searches on the UI thread.

## Next compact slices

1. Audit shared preselected operation validation and P0009 diagnostics, without changing mathematical behavior.
2. Introduce `integral` in its roadmap-owned symbolic phase; specify antiderivative integration-constant semantics and definite-integral output.
3. Explore bounded numeric root finding as its own operation, with interval partitioning and defensible completeness policy.
4. Then `tangentline`, `arclength`, `surfacearea` with clear geometry, and statistical regression under its dedicated roadmap phase. `dsolve` remains deferred.

This note is additive: it does **not** mark P0012 complete or change existing contracts.
