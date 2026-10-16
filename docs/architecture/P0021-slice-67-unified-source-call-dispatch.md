# P0021 Slice 67 — Unified source-call dispatch (GREEN)

## Purpose

The Slice 66 recursive source evaluator correctly handles composed functions but the batch dispatcher still chose different evaluator implementations for `f(2)`, `f(x)` and `f(g(2))` based on AST argument shape. That is an implementation generalization risk, not a frozen-architecture change.

## Change

All source-level `FunctionCall` statements in `createRuntimeFunctionBatchEvaluator` now use the same existing `createSourceComposedExpressionTaskEvaluator`. No callable name re-resolution or global function registry is introduced. P0020's attested provider facts, immutable FunctionValues, P0021 batch outcomes, and DocumentRuntime's existing commit/generation authority remain unchanged. This is intentionally **not** yet a universal Semantic IR executor. Assignments and function definitions retain their existing paths for now.

The old `createSourceLiteralFunctionTaskEvaluator` and `createSourceVariableFunctionTaskEvaluator` modules remain in the repository as legacy narrow adapters, but are no longer selected by the batch dispatcher; removal should follow separate call-site/dependency audit.

## Coverage

- `f(2)` literal, `f(x)` provider value, `f(1+2)` expression, `f(f(2))` nested same-name call together in DocumentRuntime.
- `f(f(f(2)))` repeatedly uses the same attested provider.
- `f(g(4))` with capture and reactive source change: `146 -> 149`.
- An unavailable inner callable fails closed; later writers are never used as fallback.

Tests: `tests/js/p0021-runtime-unified-call-dispatch.test.mjs`. Local 449/449 targeted P0021 tests pass on the reconstructed checkout; the user's Node 24 full regression is authoritative.

## Known boundaries

This slice uses an injected JS arithmetic evaluator; it is not a new live Pyodide browser test. The recursive source adapter currently understands selected AST expression kinds and the operation subset. Full general Semantic IR, multi-argument functions, operation-local symbol scopes and general mathematical Value families remain future work. No frozen architecture modification.
