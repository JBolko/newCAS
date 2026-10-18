# P0021 Slice 94a — Selected Worker client supervision (opt-in)

**Status:** GREEN candidate — requires Node 24 full-suite acceptance on developer machine.
**Architecture:** Frozen v1.0 remains normative; no contract amendment.
**Checkpoint:** `440fea3` after S93 closure. S94a is a subsequent incremental slice.

## Problem and scope

The P0021 selected Worker client previously had no per-request deadline, no pending-request cap and no terminal response to a Worker `error` or `messageerror`. A Worker stalled inside synchronous Pyodide cannot be interrupted by cancelling a JS Promise. Leaving it alive after a deadline can consume CPU indefinitely, and a client waiting for that reply may never settle.

S94a adds an **explicit, opt-in transport supervision policy**, without selecting operations, interpreting AST/IR, changing public Values, introducing Python state, or modifying the Worker-side mathematical evaluator.

```js
const client = createWorkerEvaluationClient({
  worker, // exclusively owned; must expose terminate()
  getCurrentRevision: () => currentRevision,
  supervision: {timeoutMs: 120_000, maxPending: 16},
});
```

- `timeoutMs` is the **wall-clock deadline for each request**, counted from dispatch and covering initial Pyodide startup if that occurs in the Worker. Valid integer range: 1 through 2,147,483,647 ms.
- `maxPending` is the allowed number of **unsettled requests** accepted by this client; overflow returns `WORKER_PENDING_LIMIT` and sends nothing. This is a pending-count bound, not a byte or memory quota.
- `error` and `messageerror` are terminal (`WORKER_CRASH` / `WORKER_MESSAGE_ERROR`). A deadline is terminal (`WORKER_TIMEOUT`). The first terminal event **terminates the owned Worker**, rejects **all** pending evaluations with the same stable code, detaches the listeners, clears timers, and refuses future requests.
- `close()` under supervision terminates the owned Worker, rejects pending work as `WORKER_CLIENT_CLOSED`, and is idempotent.
- Only construct a new Worker and a new client after a fatal event. **Never replay a pending evaluation automatically**; the owning DocumentRuntime must determine current revision, dependency validity and any permissible retry.
- Reply correlation (`requestId`, `revision`, `blockId`), Value decoding and stale-result checks remain at the unchanged transport boundary. Timers are cleared after success, failure, invalid responses, stale rejection or `postMessage` failure.
- The **unsupervised existing API is intentionally compatible**: with `supervision` omitted, `close()` detaches/rejects without terminating a Worker supplied by the caller. This does not make that path protected; it must be migrated explicitly after the owner has agreed to transfer Worker ownership.

## Non-goals and limits

This slice does not wire supervision into the legacy-facing UI or every browser smoke test. Until those call sites explicitly opt in, they retain their existing timeout/failure behavior. It does not add Worker restart/recovery orchestration, data-size limits, memory/CPU accounting, a hard wall-clock quota enforced in the Worker itself, or overall concurrency scheduling. `Worker.terminate()` is the cancellation boundary for synchronous Pyodide, not the Promise deadline itself. We still need browser/real-Pyodide failure-injection evidence and a designated owner for the lifetime of each production Worker.

Worker-side exceptions already turned into structured failure outcomes remain ordinary evaluations; they do not require termination. The supervised terminal events are transport/lifecycle failures.

## Verification and follow-up

- `tests/js/p0021-slice-94a-worker-supervision.test.mjs`: ten dedicated tests for success, deadline termination (all pending), `error`, `messageerror`, pending limit, close, stale revision, failed posting, invalid policy and default backward compatibility.
- Existing Worker protocol and P0005 Value rehydration tests must remain green.
- Frozen architecture tests and full JS/Python suites are mandatory before S94a is accepted.
- **Follow-up S94b:** identify the active Worker owner and explicitly opt actual non-legacy selected evaluations into supervision, plus real-browser failure injection and safe recovery policy. Do not simultaneously migrate UI, add mathematical operations or remove legacy as part of this client change.
