# P0021 Slice 63 — Task-local wall-clock debounce

**Status:** targeted Node GREEN; full Node 24 regression pending user verification.
**Baseline:** user-confirmed 849 JS tests through Slice 62; six new tests in this slice.

## Scope and ownership

`createSemanticAutoScheduler` now accepts an optional `delayMs` nonnegative safe integer. The default `0` preserves Slice 61's microtask coalescing. A positive value resets an independently managed timer **for that task only** after each successful authoritative document edit or explicit `request(taskId)`. On timer expiration the task enters the existing microtask dispatch. Timers are temporary orchestration state, **not** generations, Values, revisions, source authority, or a second runtime.

An edit arriving after timer expiry but before queued microtask dispatch removes that task from the ready set and starts a fresh debounce interval. Timers carry identity tokens to ignore canceled callbacks if they race with cancellation. `dispose()` unsubscribes, cancels timers, and prevents pending dispatch; it does not cancel already-running mathematical work.

Dependency resolution, immutable Values, task-local invocation tokens, and stale-result rejection are unchanged. Completion of *any* result, including error and stale, cannot schedule another run. Each task has an isolated debounce window; editing A never resets B's deadline nor revises B's in-flight invocation.

To make time tests deterministic, the existing opt-in scheduler accepts injected `scheduleDelay` and `cancelDelay` functions; production defaults use `setTimeout` and `clearTimeout`. `delayMs=0` continues to use `enqueue=queueMicrotask` by default. The UI may later select a delay based on editing activity, but this slice does not connect the editor and does not guarantee a maximum latency during uninterrupted typing.

## Evidence and limitations

Six focused tests cover edits across separate event times coalescing to one run (130→18); independent task timers (including B completing while A's window restarts); no post-completion enqueue; invalid edits and disposal; invalid delay/options and default compatibility; and an edit between expired timer and queued microtask flush. Slice 61/62 regression also remains green (16/16 total focused tests).

No Python changes or Pyodide browser test are needed for this JS scheduling policy. The full Node 24 regression is to be run by the user.
