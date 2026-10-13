# P0021 Slice 32 — Bound function calls via existing revisioned evaluation batch

## Scope

`createBoundFunctionTaskEvaluator` adapts the Slice 31 source-bound `FunctionValue` call to Slice 7 `createValueEvaluator`. It returns the standard `{blockId,status,value}` outcome expected by the Slice 6 `dispatchSemanticEvaluationBatch`. It does not alter the dispatcher, its revision check, the cache contract, or any frozen architectural contract.

The caller supplies a P0020 semantic snapshot, exact source call occurrence, already materialized `Value` arguments, selected arithmetic OperationSpecs and evaluator, a current-revision provider reader, and an opaque document-owned revision token. The Slice 7 gateway transports the exact provider identity and its current `FunctionValue`. No Python or source-name lookup, no implicit fallback, no new registry.

This is a **bounded adapter integration**, not yet a DocumentRuntime wiring or a real Web Worker test. The caller remains responsible for sourcing `args` from document-owned bindings (rather than trusting a UI string), for constructing batch tasks from the semantic snapshot, and for revising/invalidating upon document changes. Tests explicitly provide the revision-stamped upstream cache that the existing batch dispatcher requires.

## Verification

`node --test tests/js/p0021-bound-function-batch.test.mjs`

`node --test`

The focused six-test suite passed under Node 22 locally. The broad locally reconstructed suite has three environment-related failures from unavailable `peggy` dependency, so the full Node 24 user checkout is authoritative.

No production Python, SymPy, Pyodide, Worker, or DocumentRuntime changes are included. Next stage: real Worker smoke for this selected function evaluation path, before claiming browser coverage.
