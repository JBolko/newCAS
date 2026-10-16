# P0021 Slice 68 — Unified expression dispatch

**Status:** GREEN (local targeted regression); full Node 24 regression awaits user verification.

## Motivation

Slice 67 unified simple and composed `FunctionCall` routing, but `createRuntimeFunctionBatchEvaluator` continued to dispatch `Assignment` by literal vs nonliteral shape and `Variable` to another expression adapter. Those source-shape routes are unnecessary when the recursive P0020-attested expression evaluator can represent all those cases.

## Change

For `Assignment`, `FunctionCall`, and `Variable` source statements the existing runtime batch now selects `createSourceComposedExpressionTaskEvaluator`, which uses P0020's attested references and callable provider identities, recursively evaluates expressions and invokes the existing selected arithmetic operations and FunctionValue application. `FunctionDefinition` **remains separate** because lexical parameter and capture compilation requires its specialized builder. The existing legacy source adapters are not deleted here; removal requires a separate usage audit.

No additional runtime, binding table, document state, generation mechanism, OperationSpec or backend dispatcher is introduced. This is routing consolidation, not a general Semantic IR executor. In particular, supported expression-node families and selected operations remain limited; signed, non-integer, symbolic, multi-argument and richer expressions need their own coverage before claims of generality.

## Evidence

- New suite `tests/js/p0021-runtime-unified-expression-dispatch.test.mjs`: four tests for mixed assignment/call/read, reactive capture update, long identifier, and unresolved nested callable.
- Local P0021 regression: **453/453** green on the reconstructed checkout (Node 22).
- Full user's Node 24 regression: previous confirmed baseline **872**; expect **876** after installing this slice.

## Next

Audit remaining source-specific adapters and their call sites before retiring them. Build toward the resolved Semantic IR evaluator mandated by frozen architecture; do not broaden source AST dispatch indefinitely. Keep explicit checks for function-body binder identity, argument roles and operational scopes. Independently verify locked Pyodide/SymPy version and Worker timeout/recovery as already identified in architecture review.
