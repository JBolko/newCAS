# P0012 Slice 25 — arclength / surfacearea (bounded GREEN)

New selected Python handlers in `src/python/evaluator/scalar_geometry.py`:

- `arclength(expression: value, variable: symbolic, start: value, end: value)` evaluates `integrate(sqrt(1 + diff(f,x)**2),(x,a,b))`.
- `surfacearea(expression: value, variable: symbolic, start: value, end: value)` evaluates `integrate(2*pi*Abs(f)*sqrt(1 + diff(f,x)**2),(x,a,b))` for rotation about the x-axis, with multiplicities counted where necessary.
- Both return `ExpressionValue` or an existing P0009-shaped failure; they do not construct `RelationValue` or dispatch based on the user-facing `operationId`.
- Both use P0011 and check the selected handler capability and P0008 argument roles. No parallel dispatch registry is introduced.
- Reversed bounds that yield a negative result are rejected, not returned as geometric lengths/areas. This slice does not claim general handling of geometric self-overlap, singular/non-differentiable curves, improper integrals, symbolic undecidable constraints, or numeric quadrature.
- A formal operation registry *already exists at the OperationSpec / evaluatorId boundary*. Frontend syntax can resolve operation spelling and aliases into registered OperationSpec. Keep this separate from the Python selected-handler implementation; no competing registry.

The twelve tests in `tests/python/test_p0012_geometry_red.py` test line lengths, cylinder and cone areas, negative radii, symbol identities, contract errors and unsupported cases.

**Verification:** Isolated local suite contained 41 tests and passed, including twelve new geometry tests. The fixture here was incomplete relative to the user's actual repository, so **the full P0012 test count is not claimed locally**. Expected on the user checkout, if the previous 179 tests and all other test files remain: **191 P0012 tests**. The separate JavaScript baseline is 331 and recent P0011 suite is 16.

Install from the repository root:

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-25-geometry-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

**Follow-up:** Compare the currently registered OperationSpec vocabulary and existing parser grammar before wiring `arclength`/`surfacearea` to UI. The frozen contract deliberately distinguishes public `operationId` from internal `evaluatorId`. Both new handler IDs are temporary selected probes, not confirmed permanent registry entries.
