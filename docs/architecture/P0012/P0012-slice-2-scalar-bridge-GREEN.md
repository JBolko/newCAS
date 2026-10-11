# P0012 Slice 2 — scalar addition bridge (candidate GREEN)

**Scope:** a narrow, already-selected *binary addition* example.

`evaluate_scalar_request(request, operation_spec)` checks that the request's
`evaluatorId` matches the selected P0008 OperationSpec and converts two
ExpressionValues using a new disposable P0011 adapter. It adds them with
SymPy, then returns a P0010-shaped successful outcome with public Value.

The fixture's `operationId: probe-add` is deliberately **not** a new public
operation ID or registry entry. The `evaluatorId` is **not** hardcoded; the
matching selected spec can use either test fixture ID. A general dispatch
layer will decide which evaluator implementation to invoke later.

**Not yet covered:** JS-to-Python transport integration, P0009 failure
Diagnostics, authoritative operation registration, `constant`/`call`,
additional arithmetic operations, DocumentRuntime, legacy Task Scope.

The Python function raises exceptions for invalid/unhandled inputs as an
*internal* boundary of this candidate. It must not be exposed as a complete
P0010 public evaluator until failures are mapped into structured P0009
Diagnostics. Do not use this function for arbitrary operation specs.

## Run from repository root

```powershell
Expand-Archive -LiteralPath '.\P0012-slice-2-GREEN.zip' -DestinationPath '.' -Force
python -m unittest discover -s tests/python -p 'test_p0012_*.py' -v
python -m unittest discover -s tests/python -p 'test_sympy_value_adapter.py' -v
node --test
```

Do not mark P0012 complete at this stage.
