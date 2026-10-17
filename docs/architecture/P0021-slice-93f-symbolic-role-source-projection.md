# P0021 Slice 93f — source occurrence role projection (GREEN candidate)

## Scope and normative ownership

This slice turns S93e's three failing **source dependency projection** assertions
into ordinary mandatory regression tests. It does not change the frozen
architecture v1.0, OperationSpec, the grammar, DocumentRuntime, the active
IR evaluator, Worker/Python, or legacy. The existing P0019 rule governs how
source argument positions are scoped by a selected operation's `symbolic`
target, including the distinction between source integrand and integration
bounds. The rule lives in one pure `planSourceOccurrenceRoles` function,
shared by the P0019 selected-operation resolver and P0020 source dependency
projection. It is not a string/name exemption for `x` or `integrate`.

## Behavior

- `x:=17; integrate(x^2,x)` (two formula blocks): no document dependency
  on `x` for the mathematical operation-local target or its source integrand.
- `x:=17; y:=3; integrate(x*y,x)` retains a document dependency on `y`.
- `x:=17; integrate(x^2,x,0,x)` *does* depend on document `x` in the upper
  bound while the integrand `x` is locally bound. A separate outer `+x` is
  likewise a document read.
- The binder is introduced **only** for a selected catalog OperationSpec with
  valid arity and variable-shaped symbolic arguments and no preceding writer
  collision. Unresolved names, ambiguous calls, malformed symbolic target or
  invalid arity cannot silently introduce a symbolic binder.
- Lexical function parameters, nested symbolic operations, call-target
  classification and positional provider resolution are preserved.
- No P0019 identity changes: its existing selected source resolver consumes
  the same positional source-role policy.

## Important LIMIT: NOT active symbolic Value support

The P0020 snapshot exposes a **name-level set of document dependencies**, not
individual source-occurrence identities. The IR compiler currently attests
reads by name, and the selected catalog's symbolic operation calls are not
yet generally compiled/evaluated by the active DocumentRuntime/Worker route.
Therefore this slice must **not** be reported as end-to-end F7 GREEN. Even when
a name has both local and document meanings within one expression, this
slice proves only the required document-dependency set, not the full identity
transport. The later IR attestation must distinguish source occurrences
before enabling such symbolic calls; it must never infer symbolic identity
from a missing document dependency.

## Tests and acceptance

- Three S93e RED tests promoted to ordinary tests (not TODO).
- Ten additional mandatory boundary tests for nested/outer/bounded/malformed
  and ambiguous source occurrences.
- Existing P0019 resolver and P0020 snapshot tests, canonical parser check,
  all JS tests and all Python tests must pass on user's Node 24 checkout.
- Historical RED pressure and disposable S93e verification script may be
  removed only after complete user acceptance and exact SHA256 check.
- No release/distribution changes and no automatic Git staging.
