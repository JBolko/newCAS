# P0012 Slice 13 — common trigonometric argument boundary (GREEN)

Refactoring only: no new operations or changed public contracts.

Shared `_trigonometric_argument.py`:
- validates a preselected **unary `value`** operation with existing contract helper;
- validates required explicit `options.angleUnit` as `'deg'` or `'rad'`;
- translates the Value once through a disposable P0011 adapter;
- converts the argument from degrees to radians when requested;
- returns a failure outcome unchanged, or the adapter and radian expression.

`scalar_trigonometry.py` still owns three visibly distinct mathematical kernels:
`sp.sin`, `sp.cos`, `sp.tan`. Tangent alone owns approximate-value numerical
evaluation and the explicit-pole `undefined-result` diagnostic.

**Not a generic standard-function registry.** `exp` and `ln` should reuse
only the unary contract boundary, **not** the angle helper. This avoids
requiring an `angleUnit` for non-trigonometric functions.

**Verification:** Reconstructed local P0012 suite: 70/70 green.
The 9 Slice-5 P0011 tests in the local fixture also pass.
User checkout, pinned Pyodide and JS tests remain to be verified.

Run from the repository root:

```powershell
Expand-Archive -LiteralPath ".\\P0012-slice-13-trig-refactor-GREEN.zip" -DestinationPath "." -Force
node --test 2>&1 | Select-Object -Last 18
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

JavaScript is run **first** and only its trailing summary is displayed,
as requested. It must still exit successfully. In PowerShell, pipeline
exit statuses require care: `$LASTEXITCODE` reflects the native command
for this pipeline, but for a robust CI check, prefer separate execution
with redirected log file and explicit exit-code inspection.
