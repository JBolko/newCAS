# P0012 Slice 8 — Shared selected binary expression contract

**Status:** GREEN against the reconstructed 28-test P0012 fixture suite.

## Change

Shared *request/spec validation and diagnostic transport* have moved to a
private module `src/python/evaluator/_binary_expression_contract.py`.
The existing public entry points `evaluate_scalar_request` (addition) and
`evaluate_multiplication_request` remain unchanged in their signatures.
Their handler capabilities remain distinct, and their arithmetic kernels
are still explicit. The helper does not dispatch operations, select
OperationSpecs, or expose a public registry. No change to P0005–P0011.

The helper intentionally accepts the selected handler's capability and a
label for internal ValueErrors. These values are provided by the individual
handler, not read from user-supplied request data. The helper returns a
P0009-shaped failure or `None` to permit mathematical evaluation.

## Limits

This is the boundary shared by two **binary scalar ExpressionValue**
handlers. Do not use it for operations with multiple signatures, symbolic
targets, units or containers without separate tests and design evidence.
The existing temporary evaluatorIds stay provisional.

## Test

From repo root:

    Expand-Archive -LiteralPath .\P0012-slice-8-GREEN.zip -DestinationPath . -Force
    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
    python -m unittest discover -s tests/python -p "test_sympy_value_adapter.py" -v
    node --test

Baseline before refactor: 28 + 29 + 323 tests; expect no increase.

Only two production entry points and one private helper are included in the ZIP.
