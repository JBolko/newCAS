# P0021 Slice 26 — FunctionDefinition med dokumentejede lexical binders

## Scope

Compile Peggy `FunctionDefinition` into the existing frozen Semantic IR `define-function`, using `binderIdentity`, `LexicalIdentityScope.push` and the existing `compileSelectedSourceAst`. The caller supplies writerId, taskScopeId, OperationSpecs, provider resolver and an explicit binder-ID allocator. No new function registry, Python scope, evaluator, or document state.

## Semantik

For `x:=12; f(x):=x^3+4x`, both occurrences of `x` in the function body resolve to the binder identity, NOT to the `x:=12` provider. External `y` in `f(x):=x+y` resolves through caller-owned document binding. Multiple arguments preserve separate identities; duplicate parameter names or duplicate allocated identities fail closed. The IR is immutable and JSON serializable.

This is a *compile-only slice*. It does not evaluate `f(12)`, `f'(x)`, `g(x)` or connect function dispatch. Derivative notation is parsed as `Derivative`, not `FunctionCall`; a later contract slice must define differentiation of the function's binder and how a derivative FunctionValue is constructed, without substitution of the document `x:=12` before differentiation. Do not infer result for `g(x)` from compile-only tests.

## Tests

RED test: run the new test with the new module absent (ERR_MODULE_NOT_FOUND). GREEN: `node --test tests/js/p0021-function-lexical-definition.test.mjs` (6/6, locally Node 22). `node --test` needs the caller's complete Node 24 environment and Peggy dependency. Browser not yet tested; no runtime code changed.
