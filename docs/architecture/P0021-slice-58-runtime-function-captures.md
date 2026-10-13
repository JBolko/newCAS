# P0021 — Slice 58: DocumentRuntime function captures

**Status:** GREEN (targeted JS tests; full Node 24 suite remains user verification).

Function definitions in the existing DocumentRuntime now obtain free-variable captures from *their P0020-attested positional provider bindings* through the existing P0021 `createValueEvaluator` provider gateway. `compileSelectedFunctionDefinition` owns lexical binder resolution, and `materializeSelectedFunctionValue` constructs a P0005 immutable `FunctionValue` with explicit captured Values and `freeSymbolIdentity(taskScopeId,name)` identities.

No Python task scope, global name lookup, additional document registry, or new revision mechanism is introduced. Captures are values from the current ordered batch or explicitly validated cached outcomes; an unavailable provider fails closed. Same-named variables in different task scopes remain isolated; local function parameters shadow document writers. Changing a captured variable invalidates the function writer and downstream calls through the existing P0021 graph.

**Current bounded scope:** selected arithmetic expression bodies, one-argument calls, integer-literal assignments; capture Values must be ExpressionValues. More general assignments, recursive functions, builtins and a real Pyodide browser check remain outside Slice 58. This is an integration extension, not a change to frozen semantic contracts.

Tests: `tests/js/p0021-runtime-function-captures.test.mjs` (4 tests); previous S50 and S57 test expectations updated to match newly supported explicit captures. No production changes outside existing evaluators.
