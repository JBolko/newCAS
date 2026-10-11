# P0012 — Slice 7 RED: selected multiplication handler

**Status:** RED pressure only; no production code changed.

We have a tested selected *addition* handler after Slice 6b. The next
math operation should not be implemented as `if operationId == 'multiply'`
inside that handler. This slice specifies a second, independently selected
multiplication handler through the same P0008/P0010/P0011 boundaries.

The proposed `evaluate_multiplication_request(request, operation_spec)` is a
local interface pressure point, **not** a public dispatcher or stable
operation registry. `probe.scalar.multiply` is only a test fixture; do not
promote it to a normative identifier.

Six tests pressure exact rational and large integer arithmetic, distinct
same-spelled symbols, arity from OperationSpec, capability mismatch, and
ordinary `value` roles. Symbol-containing ExpressionValues are perfectly
valid ordinary `value` operands.

## Run from repo root

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-7-RED.zip" -DestinationPath "." -Force
python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
```

Expected first RED is an import failure for missing
`src.python.evaluator.scalar_multiplication`; therefore Python unittest
may report **one import ERROR**, rather than six individually failed tests.
That is intentional. Once the module exists, all six assertions apply.

Do not touch P0011 or hardcode public operation name as dispatch selector.
A code-sharing/refactoring decision between selected handlers belongs to a
later slice, after both behaviors provide concrete evidence.
