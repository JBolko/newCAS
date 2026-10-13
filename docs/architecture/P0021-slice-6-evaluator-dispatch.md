# P0021 Slice 6 — evaluator dispatch boundary

A small **sequential** adapter between the prepared evaluation batch (Slice 4)
and revision-stamped result contract (Slice 5). The adapter does not import or
modify DocumentRuntime, Pyodide, SymPy, the parser, or the dependency graph.

`dispatchSemanticEvaluationBatch(batch, { revision, getCurrentRevision, evaluate, cachedOutcomes })`
returns `{ kind: 'complete'|'stale'|'missing-upstream', state, ... }`.
`evaluate(task)` is injected and returns `{blockId, status:'success', value}` or
`{blockId, status:'failure', code, message}`. The task includes the source and
**exact provider identities** chosen by the document semantics; evaluators must
not rebind names against a mutable global namespace.

Before each dispatch and *after* each awaited evaluation, the dispatcher checks
the document-owned revision. A late outcome is discarded. Failed upstream blocks
cause explicit `UPSTREAM_FAILED` records without invoking the evaluator. Exceptions
from the evaluator become `EVALUATOR_ERROR` failures. The existing Slice 5 gate
validates payload portability, order and cache revision.

Out of scope: actually invoking Pyodide, Value conversion, cancellation of an
already running evaluator, scheduling/retry policy, cross-revision cache reuse,
DocumentRuntime wiring and dependency-cycle diagnostics (carried by the batch).

## Installation and test

Unzip at repository root, after P0021 Slice 5:

```powershell
Expand-Archive -LiteralPath '.\P0021-slice-6-evaluator-dispatch.zip' -DestinationPath '.' -Force
node --test tests/js/p0021-evaluation-dispatch.test.mjs
node --test
```
