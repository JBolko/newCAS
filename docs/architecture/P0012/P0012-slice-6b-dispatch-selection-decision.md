# P0012 Slice 6b — selected addition handler capability (GREEN candidate)

**Status:** limited handler fixture, NOT general dispatch or a public ID decision.

## Contradiction exposed by Slice 6

Two early fixture tests need correction: one accepted any matching evaluator IDs as sufficient to invoke addition; the other used only a changed public name to reject addition. Once we define the selected handler capability, both are incorrect.

The old negative test used only a changed `operationId` (`unknown-op`) to
assert rejection, while the new test changes the public name and expects
success when the same addition handler is selected. They cannot both be
normative: P0008 states that `operationId` is a public identity and
`evaluatorId` identifies the evaluator implementation.

We amend the older test to select a *different evaluator capability* for its
negative case. The test still proves that an unselected handler must not
silently perform addition. Only a changed public name, with the same selected
handler capability, must not affect mathematics.

## Narrow implementation

- The selected addition handler checks the matching P0010 request and
  P0008-selected spec `evaluatorId`.
- It separately verifies the spec's evaluatorId is *this handler's*
  explicitly supported capability, currently the **non-normative fixture**
  `probe.scalar.add`.
- It never dispatches based on `operationId` (which remains available in
  diagnostics).
- Existing signature/role checks remain unchanged.
- No new operation catalog, registry, public evaluator ID, or DocumentRuntime
  dependency is introduced.

This is the minimal decision for the selected-handler boundary. A real
selection mechanism and stable operation/evaluator IDs must be determined
before making a general evaluator or adding multiple handlers.

## Verification

Run `python -m unittest discover -s tests/python -p "test_p0012_*.py" -v`.
Expected **22/22** if the local test files match the prior slices.
Run P0011 Python tests and `node --test` for regression.
