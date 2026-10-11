# P0012 Slice 4 — selected OperationSpec metadata (RED)

## Pressure question

The currently green scalar addition bridge checks `evaluatorId` against the
selected OperationSpec, but hardcodes the argument labels `lhs` / `rhs` when
building type-mismatch diagnostics. Does P0008 remain the source of argument
metadata when the selected signature uses different names?

## Expectations

- The first invalid input is identified using the first selected argument name.
- The second invalid input is identified using the second selected argument name.
- Renaming arguments does not change mathematical addition.
- No new public operation ID or registry is introduced.

This is narrowly an *already selected* operation fixture. The selected
OperationSpec is not by itself permission to execute arbitrary operations;
P0012's addition implementation remains explicitly bounded.

## Deferred questions

Validating all OperationSpec signature shapes, selecting overloads, and adapting
all backend errors are separate decisions. Do not address them merely to make
this RED green. The `probe-add` ID remains a local fixture.

## Run (repository root)

```powershell
Expand-Archive -LiteralPath '.\P0012-slice-4-RED.zip' -DestinationPath '.' -Force
python -m unittest discover -s tests/python -p 'test_p0012_*.py' -v
```

Expected on Slice 3 GREEN: 13 tests, with two assertion failures for argument
names and eleven passing tests. If the actual result differs, inspect before
changing code.
