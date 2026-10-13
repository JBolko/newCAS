# P0021 Slice 36 — derived FunctionValue (GREEN)

## Contract

Given an already materialized immutable one-parameter P0005 `FunctionValue`, an already computed P0005 derivative `ExpressionValue` from the selected P0010/Pyodide path demonstrated in Slice 35, and the explicit **original lexical binder identity** used as differentiation target, `materializeSelectedDerivativeFunction({fn, derivative, targetIdentity})` returns a new immutable P0005 `FunctionValue`.

- The derived function retains the *same binder identity*; it does not allocate a binder or resolve by spelling.
- External captures were already substituted during Slice 34 request creation. The returned derivative must therefore contain only its original binder (or no symbols for a constant derivative). Foreign/free symbols fail closed.
- Result `capturedValues` is empty, because the returned body is a closed derivative expression with respect to the binder.
- Restrict this slice to one parameter and expression nodes supported by the current selected function application (`integer`, `rational`, `approx`, `constant`, `symbolRef`, `add`, `mul`, `pow`). This is a bounded capability, **not** general partial differentiation.
- The adapter is pure and does **not** execute SymPy, check a document revision, authenticate a Worker response, or construct a document result. The caller must obtain the derivative from the selected existing gateway and validate freshness before accepting the outcome.
- The resulting FunctionValue can be applied with Slice 28's existing `applySelectedFunctionValue`. The complete document-level `g(x)` workflow remains future integration work.

## Tests

`node --test tests/js/p0021-derived-function-value.test.mjs`

`node --test`

Targeted local Node 22 suite (`p0021-function-derivative`, `p0021-function-application`, `p0021-derived-function-value`, `value-contract`): **42/42 passed**. New Slice 36: **8/8 passed**. The complete 692-test baseline must be rerun in the user's Node 24 checkout; expected count is **700**. The actual Pyodide differentiation request was previously browser-confirmed in Slice 35; Slice 36 itself does not add a browser test.

## Next

Test Worker-result → derived FunctionValue → application end-to-end, and later connect document binding/revision/call semantics. Do not remove the old `DerivativeCall` Peggy rule within this slice.
