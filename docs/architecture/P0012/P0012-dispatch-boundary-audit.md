# P0012 — Dispatch boundary audit (after Slice 5)

**Status:** IN PROGRESS — audit only; no code or public-ID decision.

## Evidence

P0012 Slice 2–5 currently passes 18 Python tests; P0011 passes 29;
the user reports 323 JavaScript tests green. This is a local addition
fixture, **not** a generic evaluator/dispatcher.

Examined implementation: `src/python/evaluator/scalar_operations.py`
from the Slice 5 GREEN delivery.

## What exists

- `evaluate_scalar_request(request, operation_spec)` receives a
  **preselected** operation.
- It checks `request.evaluatorId` against `operation_spec.evaluatorId`.
- It checks `operationId == 'probe-add'`.
- It enforces exactly one selected binary signature; diagnostic argument
  names and arity come from that signature.
- It materializes inputs through one disposable `SympyValueAdapter`, adds
  them, and returns a P0010-shaped success/failure envelope.
- The supported diagnostics are limited; some malformed requests and
  incompatible selected signatures deliberately raise internal `ValueError`.

## Architectural tension

The `probe-add` guard selects *what mathematics to execute* using a
temporary **public** operation name. But P0008 distinguishes
`operationId` (public identity) from `evaluatorId` (implementation
dispatch identity). Arbitrary matching evaluator IDs are accepted today
because this is a deliberately local test fixture.

Do **not** eliminate the guard without an actual dispatch decision:
that would make every selected operation capable of being silently
evaluated as addition.

Do **not** simply hardcode `probe.scalar.add` in its place: that would
promote an experimental test ID to a public contract without review.

Do **not** create a second operation catalog inside the Python evaluator.

## Boundary decision to make before a second operation

A selected evaluator implementation must have a clear, explicit
capability identity. The P0008 OperationSpec supplies the declared
`evaluatorId`; the runtime/dispatch layer determines which handler is
selected. The individual handler checks that the supplied selection is
compatible with the behavior it implements.

The **specific** stable addition `evaluatorId` and handler-lookup
mechanism are not yet prescribed here. They must be grounded in existing
P0008 metadata and Release-1 operation requirements, not guessed from
`probe-add`.

## Proposed next RED (separate slice)

Pressure the following properties *without* extending the math catalog:

1. A selected operation's public `operationId` being renamed does not
   change the backend mathematical behavior *when the dispatch identity
   still selects the same handler*.
2. A selected spec with a mismatching evaluator capability is rejected
   **before** calling SymPy.
3. A selected signature whose argument roles do not describe two
   ordinary Values cannot be used for the addition handler, even when
   it has two arguments.
4. A programming/configuration error is not mislabeled as a user's
   arithmetic mistake.

Before writing those tests, settle the handler-selection fixture shape
and check existing OperationSpec and DiagnosticSpec vocabularies.
No new public ID, registry, or release feature is authorized by this
audit.

## Checkpoint

No changes to P0005–P0011, Symbol/Task Scope, DocumentRuntime,
parser, or public operation vocabulary. Existing green baseline stands.
