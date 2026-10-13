# P0021 Slice 30 — explicitly selected FunctionValue provider

## Scope

The document caller supplies an **exact providerId**, a gateway envelope with **one attested FunctionValue provider**, and **already materialized Value arguments**. `evaluateProviderFunctionCall` confirms the provider identity and Value kind, removes the callable provider from the arithmetic subrequest, and delegates to the existing Slice 29 `evaluateSelectedFunctionApplication`. That path uses Slice 28 identity substitution and the existing selected postorder evaluator.

No source-name or Python-scope lookup, new operation registry, revision cache, or alternate binding semantics. The caller is responsible for deriving the provider identity from document source position and for reading the current revision's provider outcome. This slice deliberately does **not** wire DocumentRuntime itself into the new evaluator path.

Bounded to Slice 29's integer `add`/`multiply`/`power` subset. Does not yet support nested user-function calls, symbolic arguments, differentiation of a user function, or real-browser execution of such a call.

## Tests

`node --test tests/js/p0021-provider-function-call.test.mjs`

`node --test`

Seven focused tests pass locally. The wider reconstructed Node 22 environment still has three tests requiring a missing `peggy` package, so the full 656-test baseline must be rerun in the user's Node 24 checkout. Expected test total (if unchanged): **663**.

## Next boundary

Connect P0020's document-selected call-target reference and current-revision provider outcome to this adapter. Before that, a real Pyodide browser smoke can reuse this adapter with an explicitly attested FunctionValue and selected arithmetic handlers. Differentiate ordinary selected provider invocation from source-based name resolution at each boundary.
