# P0012 Slice 22 — symbolic integration (bounded GREEN)

Two explicit selected signatures:

- `integral(expression: value, variable: symbolic)` returns **one antiderivative**.
- `integral(expression: value, variable: symbolic, lower: value, upper: value)` returns a definite integral.

A primitive is mathematically a representative of the family `F(x)+C`.
This handler **does not claim to represent the whole family** or invent
a new free integration constant with an unregistered semantic identity.
`+C` is a future result-semantic/presentation decision, not an implicit
new variable injected into a public Value.

Both forms retain P0006 identity for the variable and reuse P0011
transport. If SymPy cannot evaluate an integral into an already
supported public ExpressionValue (e.g. an unevaluated `Integral`),
the handler returns structured `unsupported-operation` rather than
leaking a backend object or inventing a function encoding.

Eleven P0012 regression tests include exact definite integration,
reversed bounds, partial integration, identity separation, diagnostics
and unevaluated integrals. This slice is **not** a full integration
engine: convergence, singularities, numerical quadrature, assumptions,
piecewise results, parameter domains and family-of-primitives semantics
remain to be specified.

Locally: 161/161 reconstructed P0012 tests. JS and P0011 in the
user's checkout should still be run.

From repository root:

```powershell
Expand-Archive -LiteralPath ".\\P0012-slice-22-integration-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```
