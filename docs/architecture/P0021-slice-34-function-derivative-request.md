# P0021 Slice 34 — FunctionValue → selected symbolic differentiation request

## Scope

Compiles an already materialized, one-parameter P0005 `FunctionValue` into the **existing** P0021 Slice 23 selected `probe.symbolic.diff` P0010 request. It does not evaluate the request, create a derivative `FunctionValue`, install a new registry, resolve names, or modify Python/Worker code.

The lexical parameter's **original binder SemanticIdentity** is used in both the function body and the symbolic differentiation target. This is intentionally not an operation-local identity, since the function body already refers to the binder. Captures are substituted by the existing Slice 28 identity-based function application before request compilation; document providers must not be supplied anew.

Currently bounded to exactly one parameter and to operations supported by the existing Slice 28 application. Multivariate/partial derivatives, compound-function calls in the body, derivative function construction, and applying the derivative at x=12 are subsequent slices. This does not implement `f'(x)` syntax or a complete DocumentRuntime pipeline.

## Verification

`node --test tests/js/p0021-function-derivative.test.mjs` (8 tests)

`node --test tests/js/p0021-function-*.test.mjs tests/js/p0021-symbolic-diff-gateway.test.mjs` (43 tests in the reconstructed checkout)

`node --test` in user's Node 24 checkout to verify full regression (previous user-confirmed baseline 680, expected 688 if unchanged).

Actual Python/Pyodide execution of a binder-target request is **not verified in this slice**; it requires an integration test before being called end-to-end GREEN.
