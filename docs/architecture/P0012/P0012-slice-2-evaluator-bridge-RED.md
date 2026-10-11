# P0012 Slice 2 — first scalar evaluator bridge (RED)

**Status:** contract pressure only. No production code.

## Target

A small pure evaluator bridge accepts a P0010-shaped resolved request and a
P0008-shaped already-selected OperationSpec. It computes addition using a
**single disposable P0011 SympyValueAdapter per invocation** and returns a
P0010-shaped successful `EvaluationOutcome` containing a public P0005 Value.

Candidate Python entrypoint for this pressure test:

```python
from src.python.evaluator.scalar_operations import evaluate_scalar_request
outcome = evaluate_scalar_request(request, operation_spec)
```

This is a **candidate interface**, not a frozen API. Its absence produces
intentional RED. The fixture's `probe.scalar.add` and `probe.other-add-id`
are not adopted public operation IDs. The test demonstrates dispatch by the
provided P0008 metadata rather than a second name-based registry.

## Five positive-path pressures

- Exact rational addition gives exactly 5/6.
- Huge integer remains exact.
- Different semantic identities with the same display spelling remain distinct.
- Approximate input stays approximate with precision metadata.
- Alternate `evaluatorId` supplied consistently through request/spec works.

## Explicitly deferred

No P0010 validation duplicated in Python, no new public registry, no document
state, no legacy Python Task Scope, no backend errors exposed as public
Diagnostics. **Failure mapping requires a separate P0009-based pressure test**
before this can become a complete evaluator. The test does not settle whether
Python should receive a whole OperationSpec or a dispatch descriptor produced
by the JS evaluator boundary; that integration detail must be reviewed.

## Run (repository root)

```powershell
Expand-Archive -LiteralPath '.\P0012-slice-2-RED.zip' -DestinationPath '.' -Force
python -m unittest discover -s tests/python -p 'test_p0012_*.py' -v
```

Expected: import error for the as-yet-unimplemented module. No need to touch
P0011 or the existing 323 JS / 29 Python baseline.
