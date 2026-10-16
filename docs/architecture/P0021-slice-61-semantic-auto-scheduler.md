# P0021 Slice 61 — Opt-in semantic scheduler

**Status:** focused GREEN, pending full Node 24 user regression.
**Baseline:** user-confirmed 839 JS tests after Slice 60; this slice adds 5.

## Contract

- `DocumentRuntime` emits an edit-only, task-scoped notification after successful `addBlock`, `setBlockSource`, `insertBlock`, `moveBlock`, and `removeBlock`. Failed edits do not notify. Notifications do not carry document Values, bindings or revision authority.
- `createSemanticAutoScheduler` is an optional, disposable *orchestrator*, not a document runtime or a new authoritative calculation store. It subscribes to those edits, coalesces edits from the same synchronous turn into a single microtask per task, and delegates to the existing `evaluateAndCommitDirtySemanticTask`.
- The scheduler creates **invocation tokens** separately for each task; these are not document generations. The existing DocumentRuntime source/block/generation comparison remains authoritative, and already-committed Values are the only reusable cache. Changing task A does not invalidate the invocation token of task B.
- Completion of an evaluation, including `complete`, `blocked`, `stale`, or `failure`, NEVER requests another run. Only a successful authoritative document edit or an explicit `request(taskId)` triggers work.
- The scheduler is opt-in. Until activated, the existing manual and legacy paths retain their behavior. `dispose()` stops new work; it does not cancel mathematical work already in flight.
- This slice is **microtask coalescing**, not a wall-clock debounce. Slow typing across several event-loop turns may schedule multiple rounds. A later UI-specific debounce policy can be layered on top without changing document semantics.

## Evidence

Five new Node tests cover synchronous edit coalescing (130→18), cache-preserving selective recomputation, a delayed stale generation returning after the new 18, isolation across tasks, rejected invalid edits and cleanup.

The full current Python/Pyodide stack is not exercised in this slice; earlier browser probes cover the semantic Worker boundary. This is not the migration of legacy `calculateBlock()` yet.
