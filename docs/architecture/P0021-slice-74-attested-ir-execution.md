# P0021 Slice 74 — Attested Semantic IR execution

## Scope
This slice introduces `evaluateAttestedDocumentIR`: one recursive execution primitive for the immutable IR emitted by Slice 73. This is not yet wired into DocumentRuntime's active batch.

- `value`: immutable P0005 Value.
- `provider-reference`: retrieves only the explicit providerId from the invocation envelope; never resolves source identifiers.
- `call(operation-reference,...)`: postorder selected OperationSpec dispatch through the existing `evaluateNestedSelectedCalls` gateway.
- `call(provider-reference,...)`: postorder function Value application via an explicitly injected `applyFunction` callback; **the tests use an in-memory adapter**, not real Worker/Pyodide.
- `define`: validates document blockId/writerId and returns the immutable result; DocumentRuntime alone commits result state.
- Rejects unknown, duplicate and unused provider identities, non-callable function providers, invalid operation selection and unsupported nodes. No cached result fallback.

## Boundaries and outstanding work
This slice intentionally does not remove previous source-AST implementations, change the batch dispatcher or introduce another document/runtime authority. The function-application contract must next be connected to the existing P0005 function evaluator, then exercised through DocumentRuntime including stale generations. The backend's actual behavior must be separately browser-tested for selected expressions.

## Verification
Run `node --test tests/js/p0021-attested-document-ir-execution.test.mjs tests/js/p0021-attested-document-expression-ir.test.mjs`. New tests: six. Baseline on user's checkout: 896. Expected after applying: 902.
