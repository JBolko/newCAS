# P0021 Slice 50 — runtime-owned capture-free function writer

**Status:** GREEN in focused local Node tests (5 new assertions; total 19 targeted).

## Scope

- `DocumentRuntime.deriveSemanticTask` supplies P0020's source-attested function writer.
- `DocumentRuntime.evaluateAndCommitSemanticTask` retains sole result ownership; a caller-supplied `evaluate` callback routes the selected writer through the existing P0021 `createValueEvaluator` gateway.
- The writer parses the exact source passed in the runtime-owned task envelope, compiles the selected function definition and returns an immutable P0005 `FunctionValue`.
- Parameters use binder identities derived from task-scope, document writer blockId and parameter index. A subsequent positional redefinition has its own distinct identities.
- Capture-free only. Missing captures fail closed. No Python task scope or alternate runtime is introduced.

## Limits and next action

The evaluator callback is supplied explicitly by the integration caller; runtime does not yet automatically select definition and call evaluators. The P0020 snapshot attests writer identity and name, while runtime's source/generation guard owns freshness. Further work must route each downstream `FunctionCall` to the exact current provider `FunctionValue`, with no source-name fallback, and verify whole-document results 130 / 7 and mutation behavior.

The success path has been exercised through `DocumentRuntime.evaluateAndCommitSemanticTask`, but not through live Pyodide in this slice. Tests use no backend because constructing a `FunctionValue` is pure JS.
