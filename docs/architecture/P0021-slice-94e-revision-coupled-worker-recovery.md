# P0021 Slice 94e — revision-coupled explicit Worker recovery

**Status:** GREEN candidate; Node 24 and real-browser acceptance outstanding.
**Date:** 2026-10-18
**Scope:** Application orchestration of existing DocumentRuntime selective evaluation and the S94c exclusively owned/supervised Worker transport.

## Motivation and architectural boundary

- S94a–94c supervise, stop and explicitly replace the Worker. S94d preserves P0009 Worker diagnostics in the existing calculation error slot.
- P0021 `DocumentRuntime.evaluateAndCommitDirtySemanticTask` already owns selective recomputation, document source/block-generation checks and atomic batch commit.
- A Worker restart **must not** implicitly retry document work, and transport must never mutate document source, generations, outcome slots or semantic dependencies.
- An application orchestrating both boundaries must explicitly revoke the revision of a batch that was in flight during a Worker replacement; a restarted Worker is not, by itself, a change of document revision.

## S94e implementation

`src/js/semantics/create-supervised-semantic-task-session.js` is an **opt-in application bridge**, not a second evaluator, scheduler, document state store, cache or Python task scope.

The caller supplies:

1. The **existing** DocumentRuntime instance and a single task ID.
2. A factory for new, exclusively owned Worker instances and S94a supervision policy.
3. `getCurrentRevision()` and **synchronous, caller-owned** `advanceRevision()` (fresh nonempty token every explicit restart).
4. `createEvaluate({snapshot, revision, cachedOutcomes, evaluateSelected})`, which returns the existing P0021 task evaluator, e.g. `createRuntimeFunctionBatchEvaluator`. `evaluateSelected` is strictly the selected-operation transport adapter; source/OperationSpec/provider logic stays where it already belongs.

Exposed methods: `run()`, `restart()`, `close()`.

- `run` explicitly calls the **existing** selective DocumentRuntime path. A second concurrent run is rejected; no automatic replay is scheduled.
- `restart` synchronously advances the **caller's** evaluation revision before replacing the Worker; it invalidates the currently running invocation. If Worker startup fails, the old invocation is still stale; the caller may explicitly attempt a later restart.
- A run-local ephemeral lease supplies a second commit guard, also when the caller's revision authority fails. It is only a revocation token for that invocation, **not** a parallel document calculation status, revision registry or value cache.
- `close` terminates the Worker and revokes an in-flight run. Source and block generations remain untouched.
- A failed/blocked document result is stored in the **existing** calculation slot through S94d. A later, **explicit** `run()` recomputes failed/idle/dirty blocks and reuses only successful authoritative Values at the current revision using existing S53 logic.

## Contract examples

- `a:=2+3`: old Worker hangs; `restart()` makes pending batch stale, without committing an error or replaying it; a later explicit `run()` evaluates `a` on a fresh Worker.
- `a:=2+3; b:=a+1` in **separate blocks**: `a` succeeds, Worker crashes on `b`; DocumentRuntime commits `a` as success and `b` as a diagnosed error. After explicit restart, only `b` is evaluated; `a` is cached via existing immutable Value projection.
- A source edit during an in-flight Worker request still invalidates by DocumentRuntime's own source/generation checks, even without a Worker restart.
- A settled Worker outcome cannot commit after synchronous `restart()`; the batch-local lease and caller revision invalidate it before the final document commit.

## Explicit non-goals / open work

- NOT yet wired into the student editor, legacy UI path, browser auto-scheduler or actual selected Pyodide Worker bootstrap. This is an **opt-in composition seam**; its browser probe uses a tiny test-only arithmetic Worker.
- No automatic source replay, retries, worker restart schedule, user-visible messages, i18n, new P0009 categories or changed frozen architecture semantics.
- No global coordination across multiple task sessions or document revisions: an application hosting multiple task scopes must own a shared revision authority consistently, and must not run overlapping mutable document work outside the protected session.
- Recovery from real Pyodide/SymPy startup crashes and UI workflow still need integrated release-path verification. S94b already verifies the unmodified selected SymPy Worker in a real browser; this slice does not change that backend.
- Large computations are cancelled only by terminating the Worker; P0044 performance and resource policy remain separate work.

## Acceptance evidence

- New Node contract tests exercise DocumentRuntime + the actual P0021 `createRuntimeFunctionBatchEvaluator` + the S94c WorkerOwner transport using controlled Worker fixtures, including timeout, crash, partial success/retry, revision mismatch, explicit restart, source mutation, factory failure and close.
- The manual HTML browser test uses **real module Web Workers** but only a test-specific selected arithmetic handler, not Pyodide. It must be reported separately from the Node suite.
- Full Node 24, parser-sync and Python regression suites gate code acceptance on the developer's machine. No commit in S94e.
