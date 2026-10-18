# P0021 Slice 94f — Fail-stop on Worker revision-reader failure

**Date:** 2026-10-18
**Status:** GREEN candidate; developer Node 24 acceptance required.
**Scope:** Worker transport supervision / P0009 diagnostics; no mathematical operation, source grammar, IR, Value, DocumentRuntime state, or UI changes.

## Defect and RED proof

In `createWorkerEvaluationClient`, the Worker `message` listener previously removed an entry from `pending` and cancelled its deadline **before** calling the document-owned `getCurrentRevision()` callback. If that callback threw, the exception escaped the event listener, leaving the request's Promise forever unsettled. Its deadline could no longer fire because `settle()` had already cancelled its timer. Other outstanding requests would eventually time out, but the first could not. This defeats the central S94 supervision guarantee.

The same revision callback could also throw *before* a second dispatch, leaving a previous request pending until its timeout, while the new call threw a raw exception.

New tests reproduced both defects RED before any production change.

## Narrow GREEN change

- A **thrown** revision reader during message reception rejects the already-settled request with a P0009 `WORKER_REVISION_UNAVAILABLE` diagnostic, then fails the client terminally and rejects *all* other pending requests.
- A **thrown** revision reader before dispatch fails the client terminally, rejects previously pending requests, and rejects the new request with the same diagnostic. No new message is sent.
- With opt-in supervision, fatal termination still belongs to the exclusively owned Worker client. Without supervision, the legacy/unowned Worker is *not* terminated, but the client still fails closed and removes its own listeners.
- `WORKER_REVISION_UNAVAILABLE` has no parameters. A thrown reader's raw error message/source/internal details do **not** propagate through P0009.
- A successfully read but different revision retains existing `STALE_REVISION` behavior. In particular, a `null`/revoked revision from DocumentRuntime's run lease remains ordinary stale rejection, **not** a Worker-crash diagnosis.
- The higher-level Worker owner may explicitly create a fresh client after the host fixes its revision authority. There is no automatic replay, scheduler, revision allocation, or document edit in the transport.

## Layer and contract audit

| Layer | Responsibility |
| --- | --- |
| DocumentRuntime / host | Authoritative document source, revision and generation; may revoke/advance revision. |
| Supervised semantic task session | Explicit recovery and caller-owned revision advance (S94e). |
| Worker evaluation client | Settle requests; enforce deadline/fail-stop; emit trusted P0009 transport diagnostics. |
| Worker owner | Explicitly replace a failed client; never replay automatically. |
| Evaluator / OperationSpec / Value / SymPy | Unchanged. |
| UI / i18n | Later translates P0009 diagnostic; no text introduced here. |

The existing frozen v1 architecture remains normative; S94f does not amend it.

## Checks

- Five new tests cover message-time failure with two pending calls; pre-dispatch failure while one call is pending; unsupervised termination ownership; legitimate stale revisions; explicit owner restart without replay.
- Existing supervision, diagnostic bridge, owner, document recovery, protocol and P0009 tests remain in the mandatory focus selection.
- Local Node 22: 143/143 focused JS tests, Python 264/264. The full Node 22 JS suite retains **exactly** the same eight failures and three cancelled cases as the unmodified S94e baseline in this reconstructed environment; it is not an acceptance result.
- Developer must run `tools/migrations/p0021-slice-94f-verify.ps1` on Node 24 and upload its `tools/reports/slice94f-*.zip` archive. Full code GREEN requires the parser sync and both full suites to exit 0.
- No new browser run required *for this slice*: no Worker bootstrap/Pyodide/DocumentRuntime browser integration changed. Re-run real Pyodide browser acceptance before the next major checkpoint.

## Deferred

Active editor cutover, full P0009 diagnostics/i18n coverage, automatic recovery policy, Worker payload-size governance, further symbolic operation integration and legacy retirement remain separate roadmap items. **S94f does not close all Worker hardening or P0021–P0025 exit criteria.**
