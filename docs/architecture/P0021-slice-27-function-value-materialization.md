# P0021 Slice 27 — bounded FunctionValue materialization

## Scope

The document has already compiled a Peggy `FunctionDefinition` to immutable `define-function` Semantic IR (Slice 26). `materializeSelectedFunctionValue(ir,{captures})` produces the existing P0005 `FunctionValue` without Python, source parsing or name lookup.

- Binder SemanticIdentities are preserved exactly in the `parameters` and expression body.
- Supported IR body: immutable expression Value literal; binder semantic reference; explicit provider reference; already-selected two-argument `add`, `multiply`, and `power` operation references. All other nodes fail closed.
- Document caller must supply each external capture as `{providerId,identity,value}`. Provider refs are mapped by exact providerId to a SemanticIdentity in the function body. The capture Value is retained separately in `capturedValues`; it is never injected into the function body as a number.
- Missing, duplicate, unused, or parameter-colliding captures fail closed. Non-parameter semantic references are not silently treated as document variables.
- Does not evaluate/invoke a FunctionValue, differentiate a function, or connect to DocumentRuntime commits. No backend or OperationSpec change.

**Next:** documented function application semantics, including substitution by identity and preservation of already materialized captures; do not use Python global variables.

## Checks

`node --test tests/js/p0021-function-value-materialization.test.mjs`

`node --test` in the user's Node 24 checkout.

Locally, the six new tests and the six Slice 26 tests passed (12/12) using Node 22. The full reconstructed suite was not green because three tests import an uninstalled `peggy` package and one old async test has Node 22-specific failures. User's last confirmed baseline: 637/637 before Slice 27. Thus expected 643 tests, pending user verification.
