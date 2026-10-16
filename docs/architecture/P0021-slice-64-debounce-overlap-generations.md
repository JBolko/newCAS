# P0021 Slice 64 — Debounced overlapping generations

**Status:** GREEN (deterministic Node tests; actual Pyodide Worker not exercised in this slice)

## Purpose

Confirm that the *existing* DocumentRuntime and opt-in P0021 scheduler behave correctly when an old evaluation remains pending and separate edit events are debounced into a single newer evaluation. Task-local scheduling and transient invocation tokens must not introduce new authoritative document state.

## Verified boundaries

1. Start calculation A using `x:=10`, keep its final provider outcome unresolved.
2. Modify A over separate time advances: `x:=20`, `x:=30`, `x:=3`. Only the final edit triggers one new evaluation after the 40 ms test debounce window. The new result is `f(x)=18`.
3. Release the old evaluation after the latest result is committed. Its outcome is `stale`, its `f(x)=130` is never committed, no retry is scheduled, and neither the provider visit count nor timers grow.
4. Task B (`x:=100`, `f(x)=10300`) can finish while A is stalled. Its committed Value reference and evaluator visit count remain unaffected by A's edit.
5. Disposing the scheduler cancels pending debounce timers, and a suspended evaluation cannot schedule another run when it eventually finishes.

These tests use the real DocumentRuntime, P0020/P0021 semantic source binding, the existing runtime-function-batch evaluator and the opt-in scheduler, with a deterministic fake timer and JavaScript arithmetic callback. This slice does **not** test cancellation of in-progress SymPy operations or use a live Pyodide Worker; those are different concerns.

## Ownership

Only authoritative document edits schedule automatic recalculation. Completion states (`complete`, `stale`, failures) do not enqueue follow-up work. Revision and generation validation remains with DocumentRuntime. The scheduler owns only transient per-task timers and invocation tokens; it does not own semantic bindings, Values or document revisions. No parallel runtime, registry or frozen-contract change.

## Regression

```powershell
node --test tests/js/p0021-semantic-auto-debounce-overlap.test.mjs
node --test
```

Expected overall count after the user's 855/855 baseline: **859 tests**, subject to full Node 24 verification.
