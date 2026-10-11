# P0012 Slice 17 — solve (RED architecture pressure)

Goal: `solve(equation: value, variable: symbolic)` with the already-frozen public
RelationValue input and SetValue output, **not** a `ListValue` of roots.

This RED slice intentionally imports a nonexistent `scalar_solving.py`. The
six tests will not be discovered individually until that handler exists.

Current boundary: P0011's limited ExpressionValue bridge does not yet cover
RelationValue/SetValue. A correct GREEN cannot simply call
`SympyValueAdapter.to_backend(relation)` without extending the transport.
Evaluate whether a *dedicated narrow solve adapter path* or P0011 extension is
best; either must preserve P0006 symbol identity and P0005 public Value shapes.

Open semantic decision: real versus complex solution domain. The default for
this pressure slice is **not** specified yet; `x²=4` is insensitive to that
choice. Cases such as `x²+1=0`, identities, inequalities and parameterized
solution sets should be held for distinct architecture decisions.

The same-spelling/different-identity test asserts only that `solve(x_A=2,x_B)`
must not silently produce the root 2 for x_B; define the proper solution-set
semantics in a subsequent dedicated pressure test.

Run JavaScript before Python as requested:

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-17-solve-RED.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected RED: `ModuleNotFoundError` for `scalar_solving`.
Do **not** claim the six tests pass until import succeeds and they run.
