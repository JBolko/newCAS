# P0021 Slice 11 — selected-evaluation Worker transport

A **transport-only** ES module, no Pyodide loading yet. Main-thread client accepts the P0021 Slice 7 envelope plus the P0021 Slice 9 selected operation. Worker-side callback is injected and MUST enforce the Slice 8 gateway contract. No Python-scope lookup, OperationSpec selection, or document state in the worker.

## Contract

- Correlation by unique request ID, revision and block ID.
- Reject stale revisions before dispatch and after the result arrives.
- Explicit failure outcome on worker exceptions. No silent fallback to earlier providers.
- `close()` detaches the message listener and rejects outstanding requests.
- Exactly one injected evaluation callback. Real Pyodide Worker bootstrap deferred.

## Important limits

Not yet a real Web Worker / Pyodide browser test; Node fake-worker protocol tests only. JSON snapshot is a transport check, not the full Value validator; the caller and P0021/P0010 gateways remain responsible for Value and selection validation. Revision tokens MUST be unique per document edit including undo/redo, never reused from historical content. This transport does not solve cancellation of long-running Python calculations or Worker crash/timeout recovery.

## Run

`node --test tests/js/p0021-worker-evaluation-protocol.test.mjs`

## Suggested Git checkpoint

Before the next integration phase, check `git status`, `git diff --check`, then stage the intended tracked source/tests/docs; commit with `P0021: establish contract-driven evaluation pipeline and JS/Python roundtrip` after full green suite.
