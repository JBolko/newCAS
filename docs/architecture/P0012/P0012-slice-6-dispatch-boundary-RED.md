# P0012 Slice 6 — selected-handler dispatch pressure (RED)

**Status:** RED pressure only. No production files are changed.

## Focus

P0008 distinguishes public `operationId` from implementation `evaluatorId`.
The current selected-addition handler still gates on
`operationId == "probe-add"` (a test fixture), while checking only that
the incoming and selected `evaluatorId` values agree.

These four tests distinguish:
1. Existing addition fixture (should stay GREEN).
2. Mismatched request/selected evaluator IDs (should stay GREEN).
3. Renamed public operation fixture, same selected handler capability
   (expected RED against the current public-name guard).
4. Two input arguments but a symbolic role (expected RED because role
   is currently unchecked).

## Important caveat

Test 3 **does not authorize deleting the `probe-add` check** and trusting
any equal evaluator ID. Without an explicit handler-capability selection,
doing so would silently perform addition for unrelated operations.

Before implementing GREEN, define the smallest internal way a selected
addition handler can verify its capability without turning the temporary
`probe.scalar.add` into a normative public ID and without building a
second operations registry. Distinguish dispatch selection errors from
user mathematical diagnostics.

Test 4 requires that both roles be ordinary `value`; a merely binary
signature is insufficient.

## Run

From repo root:

    Expand-Archive -LiteralPath .\\P0012-slice-6-RED.zip -DestinationPath . -Force
    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v

Expected against Slice 5 GREEN: **22 tests, 20 GREEN, 2 RED**.
Report any difference before selecting a production fix.
