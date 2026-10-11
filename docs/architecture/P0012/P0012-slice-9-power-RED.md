# P0012 Slice 9 — power RED

**Status:** RED pressure. No production code and no OperationSpec catalog changes.

Purpose: verify an already-selected binary power handler using the **existing**
private Slice 8 binary-expression contract. This is distinct from extending
addition or multiplication with another `if`, and it introduces no dispatcher.

The seven pressure cases cover:
- exact integer and negative integer powers;
- an exact irrational root (`2^(1/2)`), which must not become a Float;
- a symbolic power that retains its P0006 identity;
- OperationSpec arity and `value` versus `symbolic` roles;
- capability mismatch, so addition is not silently evaluated as power.

**Not in scope:** automatic polynomial expansion, complex branch conventions,
`0^0` policy, generic functions, numerical-precision settings, or general
signatures beyond one binary Value/Value signature. These require explicit
semantics or later evidence rather than guesses in this RED.

`probe.scalar.power` is only a temporary, handler-local test capability.

From repository root, with the ZIP placed there:

    Expand-Archive -LiteralPath .\P0012-slice-9-power-RED.zip -DestinationPath . -Force
    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v

Expected initial failure: `ModuleNotFoundError` for
`src.python.evaluator.scalar_power` (new test file cannot import).
The previous 28 tests should still pass. A test module load error is
not seven individually executed RED cases.

After RED is confirmed, inspect the representation of `sqrt(2)` through
the existing P0011 adapter before implementing GREEN: if the fixture
exposes a legitimate missing adapter form, refine the scope or document
the need, rather than improvising a backend representation.
