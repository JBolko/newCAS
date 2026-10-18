# P0021 S94d — P0009 diagnostics for Worker transport failures

**Status:** GREEN candidate; Node 24 acceptance pending.
**Baseline:** commit `440fea3` plus S94a–S94c accepted on the developer's machine.
**Date:** 2026-10-18.
**Authority:** Frozen architecture v1.0, P0009, P0010 and P0021/P0025. No frozen-contract changes.

## Problem

S94a–S94c already produce distinct technical error codes for timeouts, crashes,
capacity limits and explicit replacement. The older P0021 document calculation
slots still use `{code, message}`. In particular, an error from a transport
client caught by `dispatchSemanticEvaluationBatch` became generic
`EVALUATOR_ERROR`, losing its stable machine-readable cause.

No Danish/English string in a transport Error can be a reliable localization
contract; the student UI must eventually render a P0009 Diagnostic.

## Chosen seam

- `src/js/evaluation/worker-transport-diagnostics.js` **reuses** the existing
  `diagnosticSpec` / `diagnosticFromSpec` functions. Its private allowlist
  specifies only **Worker/owner-originated transport control codes**; it does
  not introduce a global registry. The existing Error.message remains the
  uppercase code for compatibility with existing callers, while an immutable
  P0009 `diagnostic` property carries the typed parameters.
- `WORKER_TIMEOUT` requires `{timeoutMs: non-negative-integer}`;
  `WORKER_PENDING_LIMIT` requires `{maxPending: non-negative-integer}`.
  Other listed transport-control codes currently have no parameters. A wrong
  or extra parameter is rejected at the trusted producer.
- The existing Worker client and explicit owner emit these enriched Errors
  **where the failure is known**. They do not recover, retry, parse user source
  or own document revisions. `STALE_REVISION` remains its pre-existing separate
  document/revision control error, not recategorized as a Worker failure.
- `dispatchSemanticEvaluationBatch` forwards an **already-validated P0009
  Diagnostic** when the injected evaluator rejects. It does **not** guess the
  reason by parsing `Error.message`. The historical failure shape retains
  `code` and `message`, with optional `diagnostic` during migration.
- The batch outcome gate validates the optional P0009 payload and requires
  `diagnostic.code === outcome.code`. It rejects malformed or inconsistent
  facts rather than committing them.
- `DocumentRuntime` keeps the validated diagnostic in the **existing**
  authoritative calculation error slot. No parallel store or write to the
  document source; the existing revision, source and generation guards apply.
  Downstream `UPSTREAM_FAILED` does not duplicate the root diagnosis.

## Non-goals / remaining work

1. **No i18n strings, severity/category fields or UI-rendering registry.**
   Presentation must later choose localized wording and actionable advice
   from validated P0009 facts. In particular, a timeout message could suggest
   simplifying the computation or retrying after Worker recovery, while
   preserving the distinction between a math mistake and a resource failure.
2. **No new automatic Worker restart or retry.** S94c's explicit recovery
   remains separate from document invalidation and rerun orchestration.
3. **No claim of full P0009 migration:** generic evaluator/backend failures,
   protocol `WORKER_EVALUATION_ERROR` returned as an ordinary failure outcome,
   raw `postMessage` exceptions and other legacy `code/message` producers still
   need their own diagnostic adapters. The old failure shape is intentionally
   retained for backward compatibility at the DocumentRuntime boundary.
4. **No change to semantic evaluation, Value, SymPy or Pyodide.** New guards
   only permit the pre-existing calculation state to carry P0009 facts.
5. The real student editor still uses legacy paths; the new Worker owner is
   not yet generally wired into the product UI. Browser regression is required
   on significant future integration and before the next commit/review, but
   the already accepted S94c browser tests need not be rerun for S94d's
   Node-only error-shape changes.

## Evidence and acceptance

- 19 new isolated/vertical tests covering typed DiagnosticSpecs, real client
  timeout/crash/pending-limit rejections, immutable P0009 values, ordinary
  errors not mistaken for Worker faults, DocumentRuntime source preservation,
  stale result rejection, blocked provider isolation, and fail-closed
  validation of inconsistent or malformed diagnostics.
- 113 focused tests GREEN locally including S94a–S94c, document-result and
  P0009 regression suites; Python 264/264 GREEN.
- Full local Node 22 suite compares with untouched S94c baseline: same 14
  failures and 3 cancellations (unsupported Node/Peggy setup). Node 24
  is required for definitive acceptance.
- Acceptance script runs focused suite, parser-sync check, full JS/Python and
  hash-checked cleanup of *only* the previous S94c one-shot verifier.

## Next integration focus

Once this diagnostic bridge is accepted, wire explicit transport recovery to
caller-owned batch invalidation and intentional new evaluation, then verify
through the real browser with Pyodide/SymPy at the next integration checkpoint.
That is a separate responsibility, not part of S94d.
