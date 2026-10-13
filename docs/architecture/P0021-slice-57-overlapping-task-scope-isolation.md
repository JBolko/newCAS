# P0021 Slice 57 — Overlapping task-scope isolation

**Status:** Local GREEN; user Node 24 full-suite verification pending.
**Baseline:** 817 confirmed JS tests; this slice adds 5 tests (expected 822).

## Scope of evidence

Five deterministic tests exercise the existing DocumentRuntime, P0020 source bindings, P0021 semantic batch orchestration and immutable Values without calling legacy CASEngine:

- Two distinct task scopes `A` and `B` both define `x` and `f`, and their `f(x)` calls resolve strictly to task-local function providers.
- Concurrent executions return 130 for A (`x=10`) and 10300 for B (`x=100`) with `f(t):=t^2+3t`.
- An in-flight A round is superseded after `A-x` is edited to `x:=3`; A's new result 18 survives, while B's result 10300 remains valid.
- Editing A never invalidates or needlessly re-evaluates B's unchanged providers.
- A function with an external capture `f(t):=t+x` is **not yet supported by the current runtime batch evaluator**, and fails closed rather than leaking the other scope's `x`.

## Architectural boundary

This slice adds **tests and documentation only**, no production changes, runtime registry, alternative scope resolver or contract modifications. The task scope is already determined by authoritative DocumentRuntime block ownership. An old A result is rejected as stale; it does not retry itself.

**Not proven:** Materializing lexical captures across providers and tasks, multiple real Pyodide Workers, nested function captures, or full simultaneous scheduler-driven invalidation. Captures require a future dedicated integration slice, reusing P0006/P0020 identity and explicit provider Values instead of name-based lookup.
