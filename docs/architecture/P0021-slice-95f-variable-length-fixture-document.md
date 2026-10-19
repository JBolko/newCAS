# P0021 Slice 95f — variable-length, file-driven test document

**Status:** GREEN candidate pending developer Node 24 and real Pyodide browser acceptance
**Date:** 2026-10-18
**Base:** accepted S95e after checkpoint `296fbbe`

## Scope

This is an isolated, **test-only** dynamic browser page at
`tests/browser/p0021-slice-95f-dynamic-document.html`. The accepted S95b/S95c
three-field browser probe is unchanged. The page loads between **1 and 32**
formula sources from a *temporary* `newCAS-test-sources-v2` JSON fixture,
renders one draft input per formula, and evaluates only upon explicit Calculate.

This is **not** a `.ncas` format, editor implementation, EditingSession,
production UI, document serializer, new operation dispatch, scheduler, or
alternative evaluator. Formula source remains arbitrary unparsed text until
DocumentRuntime's existing source/semantic layers process it.

The test fixture contains exactly `fixtureVersion` and `blocks`; each block
contains exactly `id` and `source`. Names are stable, distinct, bounded ASCII
identifiers (not mathematical names), no persisted outcomes, no task IDs, no
metadata, no aliases, no HTML. Fixture bytes <= 64 KiB and sources <= 1024
characters per block. A fixture import updates draft DOM inputs **only**.

## Ownership and structural edits

1. The page reads and validates *all* draft rows before any structural write.
2. On explicit Calculate, it checks the host-owned revision, advances it
   **before** structural mutation, and reconciles IDs/order using existing
   `DocumentRuntime.removeBlock`, `insertBlock`, `moveBlock`.
3. `createSemanticCalculateAction` (S95e) handles remaining source edits,
   revision advances and evaluation through the **existing** supervised semantic
   task session and selected Pyodide Worker.
4. `DocumentRuntime` remains the only authoritative source/order/calculation
   owner; input widgets remain drafts, not a parallel document state.
5. Real Pyodide/SymPy remains the only arithmetic backend for browser acceptance;
   evaluator IDs remain `probe.scalar.*` per the actual Worker allowlist.
6. Errors remain diagnostic codes; browser output uses `textContent` and safe
   DOM nodes only, with no `innerHTML`, `eval`, legacy engine or auto-retry.

### Important non-goal

This test harness **does not make multi-operation structural changes atomic**.
P0026–P0028's authoritative editing transaction/Undo/Redo contract is still
outstanding. The validation phase prevents malformed fixtures from causing
partial mutation; it is NOT a general rollback system for exceptional failures
in the middle of a valid structural edit. Do not reuse this controller as a
production EditingSession. Multi-statement source blocks remain deferred by
ADR-0006 and are NOT enabled here.

## Acceptance criteria

- The original S95b/S95c Node tests remain green unchanged.
- New S95f strict fixture, draft, validation, revision, ordering, runtime
  structural and selected-evaluator tests pass.
- Full Node 24 JavaScript and Python suites pass; canonical Peggy artifact sync.
- **Real browser:** S95f acceptance with 4 blocks (11, 18); five-block import
  changes drafts but not authoritative source; explicit Calculate yields 14, 21,
  30 using actual Pyodide; removing two blocks through explicit Calculate gives
  3 authoritative blocks with 14. Browser acceptance is necessary.
- Existing student `main.js` and frozen architecture documents are untouched.

## Further work

Before real UI cutover, the editor needs normative EditingSession transactions,
real task boundaries and authoritative variable-length document editing, plus
release-safe import/export/persistence. The S95f test fixture is never a
compatibility promise for `.ncas`.
