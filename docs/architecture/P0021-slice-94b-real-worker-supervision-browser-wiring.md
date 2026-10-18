# P0021 Slice 94b — Supervised active-IR browser proof and transport failure injection

**Status:** GREEN candidate for the code / Node 24 acceptance and **PENDING manual browser acceptance**.
**Base:** `440fea3` (S93 checkpoint) plus accepted S94a (26/26 focused; 1073 JS passed, 264 Python on Node 24).
**Authority:** Frozen architecture v1.0 remains normative; no amendments to the Value, Semantic IR, OperationSpec, DocumentRuntime or evaluator contracts.

## Problem

S94a provides **opt-in**, fail-stop supervision. Without a caller explicitly transferring Worker ownership, `Promise.race` deadlines can reject a Promise **without terminating a CPU-bound Pyodide computation**. The selected active-IR **browser acceptance harness** (S83) still used that unowned Worker pattern. S94b migrates that non-legacy selected browser proof; it does **not** assert that the production editor/UI has migrated.

## Changes and ownership

- `tests/browser/p0021-slice-83-active-ir-worker.mjs` constructs one real module `selected-pyodide-worker.js` and hands **exclusive lifetime ownership** to `createWorkerEvaluationClient({supervision:{timeoutMs:180_000,maxPending:1}})`.
- The client starts a wall-clock deadline for **each** actual evaluation, including first Pyodide startup. All evaluated batches use sequential selected operations; only one request is allowed in flight. The old outer `Promise.race` deadlines have been removed from this browser proof. A deadline kills the Worker and rejects all pending calls; it does not attempt to interrupt synchronous Python internally.
- `finally` closes the supervising client exactly once; only if client construction failed does the caller terminate the unclaimed Worker.
- DocumentRuntime remains sole owner of authoritative source, revision, dependency state and committing results. The Worker transport owns only its Worker and pending request lifecycle. **No automatic replay or client restart** is introduced.
- `tests/browser/p0021-slice-94b-worker-supervision.html` and its fixture run **real browser module Workers** that deliberately hang, throw, or return a structured test failure. This fixture **never does mathematics**. A new Worker/client accepts a fresh request after a prior terminal failure.

## Limits / remaining work

1. Browser failure-injection **must pass in a real browser** before S94b is fully accepted; unit tests or a static HTML inspection are not a substitute. The S83 real Pyodide/SymPy test must also pass with supervision enabled. CDN network access is required for the latter, not for the former.
2. This only migrates the selected **browser acceptance harness**, not `src/js/main.js` or the legacy-facing production UI; it is a proof of ownership before later UI cutover.
3. `timeoutMs:180_000` is an acceptance-harness policy, not a universal product timeout. Product UX/size/memory limits and restart policy need explicit ownership and decisions after real-browser evidence.
4. A Worker deadline cannot preempt main-thread source parsing or JS logic, and the existing protocol's `maxPending` is a count limit rather than an input/output byte quota.
5. Do not confuse a terminal Worker transport error with an ordinary mathematical failure outcome; an ordinary failure need not terminate the Worker.

## Acceptance

Run `tools/migrations/p0021-slice-94b-verify.ps1` for focus tests, canonical parser, full JS and full Python. The script reports **code acceptance only**.

Separately, from the repo root start `python -m http.server 8000`, then visit in a browser:

1. `http://localhost:8000/tests/browser/p0021-slice-94b-worker-supervision.html` — click **Kør Worker-supervisionstest**, expect `PASS — 6 browserkontroller ...`.
2. `http://localhost:8000/tests/browser/p0021-slice-83-active-ir-worker.html` — click **Kør real-Worker-accept**, expect `PASS — aktiv IR gennem rigtig Pyodide/SymPy-Worker` and the original computed results 146/147, 154/155, 149/150.

A previous real-Pyodide pass from **before S94b** does not establish that the supervised route remains green. Do not mark S94b fully GREEN until both browser checks pass.
