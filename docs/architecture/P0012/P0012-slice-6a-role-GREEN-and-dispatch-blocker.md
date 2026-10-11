# P0012 Slice 6a — argument-role validation GREEN; dispatch selection unresolved

The selected addition handler now explicitly requires two `role: value` operands. An `ExpressionValue` can contain free symbols: mathematical symbolic arithmetic is not prohibited.

## Why this is only partial GREEN

An earlier Slice 3 test insists that `operationId: unknown-op` must yield `unsupported-operation` even when request/selected evaluator IDs match. Slice 6 expects a different public operation name to succeed with that same matching evaluator ID. The current interface contains no additional trusted evidence to distinguish these cases. Removing the `probe-add` gate would satisfy the new name-renaming test but break the older unknown-operation test and risk silently dispatching wrong mathematics. Hardcoding a list of accepted names would be a workaround.

Resolve at the actual dispatch selection boundary: decide how a handler selected via P0008 evaluatorId receives trusted evidence that it was selected for addition. Only then remove the temporary public-name gate and reconcile tests. Neither fixture is a normative public operation catalog.

Expected test status against the five existing P0012 test files plus Slice 6: 21 GREEN / 1 RED (`test_public_operation_name_is_not_a_handler_selection_key`). No P0005–P0011 changes.
