# P0021 Slice 60 — three overlapping generations with lexical captures

**Date:** 2026-10-13
**Scope:** deterministic DocumentRuntime stress regression, not a new execution path.

## Baseline and purpose

Building on confirmed Slice 59 (834 green JS tests plus real Pyodide browser smoke), test stronger concurrency: three overlapping calls to `evaluateAndCommitDirtySemanticTask()` for task A, with source changes `x:=10 -> x:=20 -> x:=30` and captured function `f(t):=t+x`. Task B owns distinct `x:=100`, same source names, and must remain unchanged.

## Invariants verified

- The newest generation computes `f(3)=33` and commits before either older generation finishes.
- Both older generations return `kind:'stale'` and cannot overwrite the new result.
- Even if the caller mistakenly reuses the same external revision string, DocumentRuntime's source/generation checks reject stale results.
- Task B retains `f(3)=103`, its capture identity and successful calculation slot.
- Stale completions do not cause automatic retries, and a change to A invalidates only A's capture chain.
- No alternative registry, persistent Python scope, revised frozen contract or production code was introduced.

## Evidence and limits

`node --test tests/js/p0021-runtime-multi-generation-captures.test.mjs` — 5/5 pass locally.

The tests use controlled deferred promises and the selected arithmetic JavaScript evaluator, not real Worker cancellation or three simultaneous Pyodide executions. The real Worker/capture integration remains evidenced independently by Slice 59 browser tests, confirmed by the user. A full Node 24 regression remains to be run in the user's checkout; expected count is 839 from the confirmed baseline of 834.

## Next direction

Move toward a single shared, caller-owned scheduling policy and eventually a real Worker stress test; no automatic retry on `stale`. Review the stale-but-not-interrupted work cost separately from correctness.
