# P0021 S94c — Explicit, generation-fenced Worker replacement

**Status:** GREEN candidate; final Node 24 and real-browser acceptance pending.
**Baseline:** `440fea3` (S93 checkpoint) + accepted S94a and S94b.
**Date:** 2026-10-18.
**Authority:** Frozen architecture v1.0, P0009 Diagnostic, P0021/P0025 document-generation contracts. No normative changes.

## Why

S94a makes one supervised `createWorkerEvaluationClient` fail-stop on timeout/crash.
S94b verifies termination against real Web Workers and actual Pyodide/SymPy.
The client must **not** resurrect a killed Worker. A separate, explicit owner can
replace it while keeping the public transport protocol and document authority unchanged.

## Ownership and boundaries

`src/js/evaluation/create-supervised-worker-owner.js` composes the **existing**
`createWorkerEvaluationClient`. Its only responsibilities are:

1. Obtain an exclusively owned Worker from the caller's synchronous `createWorker` factory.
2. Construct one supervised transport client; clean up a Worker if construction fails.
3. Delegate `evaluate(envelope,selection)` unchanged to that transport client.
4. On **explicit** `restart()`, invalidate the previous generation, close/terminate the
   previous client, and open one fresh Worker and client.
5. Reject a success that was resolved by the old client just before a restart but
   delivered to the caller afterwards (`WORKER_GENERATION_STALE`).
6. On failed replacement, stay unavailable until another explicit restart; on
   permanent `close()`, never permit restart.

**No** automatic retries, semantic fallback, replay, reparsing, Python task scope,
Value conversion, selection of operations or source/document mutation. Value
rehydration remains in the S94a worker transport. This module is not an evaluator.

### Important: document generation remains outside transport

Worker-generation fencing ensures **successful transport values** cannot escape
from an invalidated owner lease. It does NOT replace P0025 document-generation
and stale-commit checks. In particular, the existing semantic dispatcher can
convert a rejected transport call into a `failure` outcome. Therefore, the
**application/orchestrator must invalidate its document evaluation revision**
when replacing a Worker that has an active batch if that batch must not commit.
The owner neither increments a document revision nor prevents a caller from
committing an error from an unchanged document revision.

Do not claim completed user-facing auto-recovery, retry or lost-work prevention.
An editor UI still needs to retain authoritative source, invalidate active
runs, decide which task to rerun, and present a localized diagnostic. That work
belongs in a later UI/orchestration slice.

### Failure semantics

- Existing transport errors remain as in S94a: `WORKER_TIMEOUT`, `WORKER_CRASH`,
  `WORKER_MESSAGE_ERROR`, `WORKER_CLIENT_CLOSED`, `WORKER_PENDING_LIMIT`.
- Owner-only errors: `WORKER_GENERATION_STALE`, `WORKER_OWNER_UNAVAILABLE`,
  `WORKER_OWNER_CLOSED`.
- These are currently **transport control error codes**, not newly registered
  P0009 DiagnosticSpecs. A later diagnostic adapter must map them into stable
  structured P0009 Diagnostics; user-facing wording/i18n is a presentation concern.

## Proof

- 11 direct JS lifecycle/recovery tests, 2 browser-source contract tests.
- 45 focused tests including existing S94a/S94b worker and transport suites.
- 264 Python tests locally.
- Local Node 22 full JS suite has the same preexisting 14 failures and 3
  cancellations as unchanged S94b (missing Peggy/incompatible Node baseline).
- **Required on user's Node 24:** focused, parser sync, full JS and Python.
- **Required in real browser:** `tests/browser/p0021-slice-94c-worker-recovery.html`
  should report `PASS — 6 browserkontroller af eksplicit Worker-genstart`.
- S94b already validated actual Pyodide/SymPy Worker. No changed mathematical
  adapter / Worker implementation / OperationSpec: no extra Pyodide load required
  for S94c; repeat full Pyodide acceptance at the next integration checkpoint.

## Exits and next work

S94c exits only after both Node 24 and manual real-Worker acceptance. The active
student UI does **not** use this owner yet. A subsequent integration slice must
connect the real caller's document-revision invalidation to explicit Worker
replacement, and test failure + fresh task evaluation end-to-end without an
implicit stale commit. Do not cross this boundary by inserting a second runtime.
