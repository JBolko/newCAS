# P0021 Slice 95j — Enter submission through existing P0026/S95e boundaries

**Status:** GREEN candidate; Node 24 acceptance required. 19 October 2026.

## Scope

This is the first selected *UI-action contract* for an Enter keypress. It adds
`submitFormulaEditorEnter` to the existing `src/js/ui/create-semantic-calculate-action.js`
module; it does **not** create a new architectural layer.

- A plain, non-repeated Enter (outside IME composition) invokes the existing
  S95i `EditingSession.prepareCommit()`, passes exactly one proposed source
  through the existing S95e `calculate([draft])` action, and calls
  `EditingSession.finishCommit()` after the source has been committed.
- Key interpretation belongs to the UI boundary. Modified Enter, a repeated
  Enter, IME composition and unrelated keys do not commit and do not suppress
  default browser behavior.
- DocumentRuntime is still the only authoritative source/identity and
  dependency owner; S95e is the only source mutation/evaluation entrypoint.
- The selected evaluation session and Worker own mathematical execution. There
  is no new parser, scheduler, Symbol/Value interpretation or legacy fallback.

## Failure ownership

- Rejected stale block identities and edit generations abort before changing
  source or revision.
- If the action rejects **before** committing, S95i `retryDraft()` preserves
  the buffer for correction, provided the original base is still current.
- If the action rejects **after** source commit (e.g. Worker timeout),
  `finishCommit()` closes the now-authoritative buffer. The failed evaluation
  is not undone or silently retried; the user may explicitly evaluate again.
- In a concurrent conflict which cannot be safely classified, the existing
  pending guard remains intact: fail closed, no implicit rollback/replay.

The caller retains responsibility for displaying P0009 diagnostics through
renderer/i18n. This slice does not invent localized error messages.

## Not implemented

No active `main.js` wiring, structural transactions, Undo/Redo, draft history,
multiple concurrent editors, additional task allocation, or `.ncas` schema
changes. A real-browser Enter proof is the next separately accepted Slice 95k.

## Acceptance

11 direct Enter tests and 94 focused regression tests were green in local
Node 22. Python 264/264 green. Full JavaScript/Node 24 acceptance is required.
