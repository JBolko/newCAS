# P0021 Slice 7 — Value evaluator gateway

## Scope

Connect P0021 tasks to an injected, portable evaluator boundary. `createValueEvaluator` builds an immutable request with `protocol`, `revision`, `blockId`, `taskScopeId`, `source` and provider bindings `{name, providerId, value}`. Provider values are caller-supplied from document-owned, revision-filtered outcomes. Missing/failed/nonportable provider values fail closed before backend invocation. Inconsistent name/graph mappings throw.

## Important boundary

**This is not yet the Pyodide integration.** `invoke(request)` must later be implemented using the P0011/OperationSpec/Value evaluation path. The *old* `CASEngine.calculate(ast, taskId)` cannot be substituted: it translates AST into Python source and uses Python task-scoped state; its binding semantics are not the new document-owned semantics. The current JS dispatcher can normalize gateway exceptions.

The gateway deliberately does **not** parse source, select OperationSpecs, marshal SymPy objects, or interpret symbolic argument roles. The future evaluator adapter must still map the canonical semantic request to a P0011-compatible evaluation request (and must explicitly reject unsupported operations). This slice does not imply that conversion already exists.

## Explicit limitation

Caller must supply outcomes from the **current revision only**. The gateway cannot attest to the revision of a raw outcome; a later slice should pass revision-stamped records and reject stale data at the gateway itself. No cross-revision cache optimization. Web Worker and Pyodide are not instantiated here.

## Test

`node --test tests/js/p0021-value-evaluator-gateway.test.mjs`
