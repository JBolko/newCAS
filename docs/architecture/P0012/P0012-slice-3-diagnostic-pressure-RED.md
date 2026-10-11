# P0012 Slice 3 — structured diagnostic pressure (RED)

**Status:** RED candidate. No production modifications.

## Scope

The selected scalar addition bridge presently throws `ValueError` for
invalid arity, unsupported selected operation and dispatch mismatch;
backend Value type failures may also escape as Python exceptions.
These tests pressure the P0009/P0010 invariant that evaluator failures
are carried as structured `EvaluationOutcome` failures.

## Cases

1. Too few inputs: `wrong-arity`, stable facts.
2. Too many inputs: `wrong-arity`, stable facts.
3. Matrix supplied as scalar: `type-mismatch` and argument role.
4. Selected fixture operation is unsupported: `unsupported-operation`.
5. Mismatched `evaluatorId`: structured failure rather than Python exception;
   **exact code intentionally not frozen by this test**.

The first four expected diagnostic names and shapes come from the
existing P0009 examples/frozen diagnostic family. This is *pressure*:
if a name/parameter scheme is not normative for a particular failure,
review the requirement before implementing a compatibility shim.

The existing `probe-add` and `probe.scalar.add` remain test fixtures,
**not a public registry**. P0012 must not introduce document authority,
source-text resolution, or another dispatch system.

## Running RED

From the repository root:

```powershell
Expand-Archive -LiteralPath '.\P0012-slice-3-RED.zip' -DestinationPath '.' -Force
python -m unittest discover -s tests/python -p 'test_p0012_*.py' -v
```

Expected: existing five happy-path tests still GREEN; these new tests
fail with raw Python exceptions. Do not repair P0009/P0010 to make them green.
