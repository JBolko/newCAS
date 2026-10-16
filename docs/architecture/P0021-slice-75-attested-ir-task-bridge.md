# P0021 Slice 75 — P0020 task gateway → attested IR (staged GREEN)

Checkpoint prerequisite: Slice 74 (902/902 user-verified).

## Scope

`createAttestedIRTaskEvaluator` is a *new, opt-in* adapter. It receives the P0020
snapshot, parses the source once for compilation, compiles Slice 73 attested IR,
and executes Slice 74 IR against the current task's provider Values. The
Slice 7 `createValueEvaluator` gateway validates task dependency references,
current-revision outcomes and transport-safe immutable requests. It does not
re-resolve function names or create a parallel document registry.

**No existing production module is modified.** The active batch dispatcher
still uses the source-expression path. Switching the batch over is a later
step, gated on end-to-end DocumentRuntime tests in the full project checkout.

## Tests

- `a*b+1` with provider Values gives 7.
- Assignment writer must be attested; long identifier `ab` remains one name.
- An unavailable upstream provider returns a failure outcome, not fallback.
- Incorrect provider outcome identity is rejected at the gateway.
- Nested `f(g(4))` executes using both attested callable identities; FunctionValues
  are compared semantically because the gateway transport freezes/copies Values.

## Still open

- Active batch integration; captures and generation overlap under the new path.
- Real Pyodide Worker browser acceptance of the new *task bridge*.
- Universal IR for function definitions, multi-argument callables and complete
  OperationSpec argument roles.

The older evaluator files remain protected by Slice 69–70 audits. No normative
architecture contracts are revised.
