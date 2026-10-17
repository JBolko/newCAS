# P0021 Slice 93g — attested symbolic occurrence IR (GREEN candidate)

## Motivation and scope

S93f corrected source dependency projection, not IR. The name `x` can have
**two different occurrences** in a single expression: in
`integrate(x^2,x,0,x)`, the first and second `x` are operation-local, while
the upper bound `x` refers to a previously attested document writer.

S93g permits **compile-only** lowering of *already classified* selected P0008
symbolic operations to immutable Semantic IR, reusing P0019's
`resolveSelectedOperationCall` and S93f's `planSourceOccurrenceRoles`.
The resulting IR uses `semantic-reference(operation-local identity)` for
local occurrences and `provider-reference(providerId)` for document reads.
The arithmetic and AST walkers introduced in S93a/S93b remain the same.

This does **not** activate symbolic evaluation in the current DocumentRuntime,
evaluator, Worker, or Python. The existing active bridge still calls the
compiler without the required symbolic identity supplier and therefore
fails closed. A later slice must provide document-owned stable identities,
attestation and value-materialization rules, before enabling the operation.

## Invariants

- P0020's `entry.calls` must classify an operation unambiguously as
  `operation`. A preceding document writer with the same name is ambiguous:
  no fallback or local binder is introduced.
- The caller must explicitly select a P0008 OperationSpec **equivalent to the
  immutable catalog policy**, including evaluator ID, signatures and roles.
  It may be reconstituted from data: reference equality is not required.
- Caller explicitly supplies `taskScopeId` and `makeLocalId`. No implicit
  name-based identity creation, runtime registry or Python string generation.
  Duplicate local identity IDs are rejected within a compiled statement.
- Dependencies already derived in S93f must be *consumed*. No fabricated,
  ambiguous or unused provider/call attestation is allowed.
- Integrand/target `x`, independent document `y`, document upper-bound `x`,
  outer `+x`, and nested local `x` remain distinct at the IR level.
- Ordinary v1 document IR remains byte-for-byte unchanged when the new
  optional identity inputs are absent.

## Follow-ups / not claimed

- **F7 remains only partially implemented**: this slice does not evaluate
  symbolic operations or transport operation-local identities to Python.
  Existing `evaluateAttestedDocumentIR` intentionally rejects
  `semantic-reference` nodes until a reviewed execution contract exists.
- Consider per-occurrence snapshots instead of P0020's name-level attestation
  if the same name can resolve to multiple document writers in one statement;
  do not simulate this with string rewriting or hidden lookups.
- Validate caller-owned local IDs against wider task-scoped identity policy,
  plus generation/staleness, before activating this path.
- No frozen v1.0 document contract, parser grammar, runtime, security policy,
  FunctionValue transport, Worker or Python code is changed here.

## Acceptance

Mandatory S93g focused tests, existing S93f/P0019 tests, canonical parser
`--check`, complete JavaScript and Python regressions on the user's Node 24.
Do not mark the slice GREEN without the user's logs. The temporary S93f
verification script may be removed after acceptance only when its SHA256
matches the delivered version. No other cleanup, git staging or release.
