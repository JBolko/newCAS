# P0021 Slice 56 — Overlapping semantic calculation rounds

**Status:** targeted Node GREEN (4 new tests). Full Node 24 regression and genuine Pyodide concurrency are not yet verified.

## Tested invariant

Two overlapping `DocumentRuntime.evaluateAndCommitDirtySemanticTask` invocations must not allow an older completion to overwrite a newer committed calculation. A `stale` outcome ends that invocation; it must not launch an implicit retry.

Scenarios:

1. Old `x:=10` round pauses before `f(x)`; source changes to `x:=3`; newer round commits 18; older round finishes last and is stale.
2. External revision superseded without editing source: older result rejected.
3. Both rounds are explicitly held; newest finishes first and persists its 18 result; old finishes last without replacement or retries.
4. Same external revision token is mistakenly reused across a document edit: existing DocumentRuntime source/generation guard still rejects the old round.

Only existing DocumentRuntime, P0020/P0021 source binding, value evaluator, and batch dispatcher are exercised. The controlled asynchronous `evaluate` callback is a deterministic test double, not a real browser/Pyodide Worker.

## Boundary and remaining risk

These tests operate within one task scope and do not cover simultaneous independent task scopes, lexical captures across edits, browser Worker concurrency, or UI-triggered automatic retry. Those require distinct tests. No production code or frozen normative architecture changed.
