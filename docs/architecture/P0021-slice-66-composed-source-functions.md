# P0021 Slice 66 — composed document functions (selected arithmetic)

**Status:** Local targeted GREEN; user Node 24 full regression pending.

## Contract

A document-owned expression `f(g(4))` is evaluated by recursively visiting the existing Peggy AST. Every callable must match P0020's *already-selected* callable fact (name, providerId, document-writer classification); every variable must match P0020's selected variable provider. P0021 supplies the current-revision immutable `FunctionValue` and captured expression Values. Calls are applied through the existing `evaluateSelectedFunctionApplication` and arithmetic is evaluated via the existing selected OperationSpec/IR gateway. No Python scope, runtime name search, persistent callable registry, or new DocumentRuntime.

A nested repetition such as `f(f(2))` deliberately reuses one P0020 callable fact: the P0020 snapshot records resolved callable **names**, not one fact per call occurrence. This emerged as a RED test before adjustment.

The bounded new source-expression adapter is selected for top-level function calls with nested call/expression arguments. The legacy one-literal/one-variable adapters remain in place pending generalization; this slice does **not** claim to implement the final all-source recursive Semantic IR evaluator. This slice's recursion visits Peggy expression nodes and uses selected operations; it is a controlled extension, not a completed universal interpreter. Future migration should merge these execution paths without weakening source attestation.

## Evidence

- `a:=2; f(x):=x^2+a; g(x):=3x; f(g(4))` => 146.
- `f(x):=x^2+1; f(f(2))` => 26.
- Change `a` to 5: 149; `g` remains unchanged.
- `f(g(4))` before any definition of `g` must not bind a later `g`.

## Outstanding

Multi-argument functions; general expressions with nested calls at arbitrary positions; symbolic/scoped OperationSpec roles; a single semantic-IR evaluator for all source forms; real-Worker browser verification for this exact composed document scenario; final migration from CASEngine.
