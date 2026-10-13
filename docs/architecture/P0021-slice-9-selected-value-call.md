# P0021 Slice 9 — Selected Semantic IR value-call compilation

## Contract

`compileSelectedValueCall(envelope, ir, spec)` accepts the immutable Semantic IR `define(writerId, call(operationReference(operationId), args))` (or a bare call), an **explicitly selected** P0008 OperationSpec and the P0021 Slice 7 gateway envelope. It validates writer identity, operation identity, signature/arity and provider identities and constructs the **selection** consumed by P0021 Slice 8 `evaluate_selected_gateway`: `evaluationRequest`, `operationSpec`, plus matching source/revision/provider attestations.

In this first slice only `value` arguments containing direct `valueLiteral` or `providerReference` are supported. A provider reference must match the **exact providerId**, with no name-based fallback. Symbolic/scoped arguments, nested expressions, application-wide OperationSpec selection, source-to-IR conversion and Pyodide invocation are not implemented. Unsupported cases fail closed.

## Repository integration

New files only:
- `src/js/semantics/compile-selected-value-call.js`
- `tests/js/p0021-compile-selected-value-call.test.mjs`
- This document.

Requires existing `semantic-ir.js`, `operation-argument-plan.js`, and `operation-spec.js`. No replacements for these established components are included.

`node --test tests/js/p0021-compile-selected-value-call.test.mjs`

## Next

Cross-language smoke test against the real P0012/P0011 handler through P0021 Slice 8, then extend expression compilation under explicit argument-role semantics. No persistent Python task scope.
