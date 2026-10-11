# P0012 Slice 18 — finite real equation systems (GREEN)

A separate **preselected** `probe.symbolic.solve-system` handler accepts a `ListValue` of equality `RelationValue`s and a `ListValue` of ordered target `symbolRef` ExpressionValues. The signature uses `[value, symbolic]` roles. This does not change the original two-argument scalar `solve` handler, its capability, or frozen contracts.

The output is a finite `SetValue` of ordered `VectorValue`s, with each vector component corresponding to the input variable list in the same position. This avoids treating solution coordinates as independent choices. `SetValue` remains unordered; solution index is not stable semantics. A future UI should display each vector alongside the associated variable names.

Example: two solutions `(x,y)=(2,1),(-1,-2)` yield `finiteSet([vector([2,1]),vector([-1,-2])])` in a canonical serialization order (order of vectors is not mathematically meaningful). The user can extract one complete vector or select a coordinate *after* a document/list/vector-indexing operation has been defined and implemented; Slice 18 itself does not expose new indexing syntax. For three variables, vectors have three elements and the mathematical machinery is identical.

Only **finite isolated real solutions** are currently accepted. Unsupported infinite/parametric/complex/conditional solution sets receive a structured failure rather than a misleading finite solution set. An inconsistent system returns empty SetValue. Domain will be made explicit in a later design slice. No general symbolic set backend conversion or persistent SymPy state is introduced.

Local reconstructed regression: **129/129 P0012** (119 prior plus 10). This does not certify the user's repository or Pyodide; run there.

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-18-system-solving-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Future: explicit solution-domain policy, parametric/infinite sets, operation selection/dispatch integration, and user-facing extraction syntax.
