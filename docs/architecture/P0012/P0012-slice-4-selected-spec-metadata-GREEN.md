# P0012 Slice 4 — selected OperationSpec metadata (GREEN)

**Scope:** An already selected *single binary* addition fixture. The
selected OperationSpec provides argument names for `type-mismatch`
Diagnostics; no `lhs`/`rhs` names are duplicated in evaluator code.

The mathematical addition remains unchanged. `probe-add` is temporary,
not an official public operation or new dispatch registry.

The function explicitly rejects ambiguous/malformed signature metadata.
It does not implement signature selection or general arity rules; those
belong to a later slice consuming the normative P0008 OperationSpec.

Test: three Slice 4 pressure cases, together with ten previous P0012
cases. No adapter or public-contract changes.
