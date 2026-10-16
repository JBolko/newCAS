# P0021 Slice 62 — Overlapping semantic scheduler rounds

**Status:** Local RED→GREEN regression, no production change.

**Baseline:** User-confirmed 844 JS tests after Slice 61. Adds five JS tests; expected 849 in supported Node 24 checkout.

## Test boundary

Existing DocumentRuntime remains the single authority for document source, calculated Values and block generations. The opt-in Slice 61 scheduler owns only a transient task queue and per-task invocation tokens. No Python task scope, additional document cache, retry loop, or second runtime is introduced.

The five tests cover:

1. While an earlier round is suspended, three successive authoritative edits coalesce into one newest round, which commits the current result.
2. The newest round commits before the older one is released; the late stale completion cannot change the result or generation and never retries.
3. A suspended round in task A cannot invalidate the already committed result or immutable Value of task B.
4. An evaluator exception is represented by the established batch outcome contract, without automatic scheduler retry. Count execution attempts, not errors reported at the scheduler promise boundary.
5. Following that failed attempt, a *new authoritative edit* requests exactly one fresh run, which can succeed; no extra run is spawned by the earlier failure.

No wall-clock timers or non-deterministic scheduling assumptions are used. Tests suspend the evaluator with explicit promise gates.

## Scope and remaining risks

This verifies the current scheduler's microtask coalescing and its interaction with DocumentRuntime's revision/generation checks. It does not implement inter-keystroke debounce, cancellation of an already-running Pyodide operation, or UI integration; those remain later slices. These are Node integration tests; genuine Worker behavior was separately exercised in Slice 59.

## Commands

```powershell
node --test tests/js/p0021-semantic-auto-overlap.test.mjs
node --test
```
