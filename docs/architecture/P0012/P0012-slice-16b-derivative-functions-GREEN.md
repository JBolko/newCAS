# P0012 Slice 16b — differentiation of elementary functions (GREEN)

This is a regression-pressure follow-up, not an expansion of the evaluator API.

## Why this package includes Slice 16 again

The most recent user output reported 95 P0012 tests, equal to the pre-Slice-16 count, while Slice 16 should increase discovery to 107. To prevent accidentally proceeding without the differentiation implementation or its tests, this archive re-includes the **unchanged** Slice 16 handler and original 12 tests. It adds six tests in `test_p0012_differentiation_functions_red.py`.

The six additions cover `diff(sin(x),x)`, `diff(cos(x),x)`, `diff(exp(x),x)`, `diff(ln(x),x)` (the internal adapter node is `call(name="log")`), the chain rule for `sin(x**2)`, and nested mixed differentiation `d/dy(d(x*y)/dx)`.

No special partial-derivative API, implicit-differentiation API, equation model, or higher-order signature is introduced here.

**Local test:** 113/113 P0012 tests (95 earlier + 12 Slice 16 + 6 Slice 16b). No new production code beyond Slice 16. The user's existing JavaScript and P0011 runs must be checked separately.

## Install and verify (repository root, PowerShell)

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-16b-derivative-functions-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected P0012 count is **113**, not 95. If it is 95, verify the two new differentiation test files exist and the archive was expanded in the repository root.

## What implicit differentiation would require

For a relation `F(x,y)=0`, the mathematical identity at regular points is
`dy/dx = -F_x/F_y` where `F_y != 0`. The current `diff(expression,symbol)` already supplies the partial derivatives; complete implicit differentiation additionally requires a relation representation, dependent-variable intent, and conditions on the denominator. In a separate future design, derivatives of explicitly symbolic functions `y(x)` would require a corresponding FunctionValue/application semantics. Do not infer that the current Slice 16 implements either.
