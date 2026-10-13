# P0012 Slice 24 — tangentline (bounded GREEN)

## Contract

`evaluate_tangentline_request` is a **selected** operation. Its
OperationSpec has three arguments in order: `expression: value`,
`variable: symbolic`, `at: value`; current evaluator ID fixture:
`probe.symbolic.tangentline`.

The result is an **ExpressionValue** with the right-hand side of
`f(a) + f'(a)*(x-a)`. It does **not** invent or bind `y` and does not
return a RelationValue. A user-facing `y = tangentline(...)` is a
separate relation-construction concern owned by the language/runtime.

The handler translates inputs with one disposable P0011 adapter,
uses SymPy `diff`, `subs` and `expand`, then translates output back.
Its narrow initial scope requires a non-symbolic evaluation point.
Unsupported backend forms return `unsupported-operation`; malformed
selected signatures are internal contract errors.

## Symbolic upper integration bound

A separate permanent test confirms the previously requested
`integral(3*x^2,x,1,x)+2 = x^3+1`, subject to the existing Value
transport and a single semantic identity for the integration symbol
and upper endpoint.

## Verification

11 new tests pass locally (10 tangentline + 1 integral bound).
The local fixture used for this run contains **29** P0012 tests,
not the complete user repository. The entire suite is therefore **not**
claimed as verified in this ZIP build. User's most recent full baseline:
331 JS, 168 P0012, 16 recent P0011. Expected P0012 total is **179**
if the previously installed suite is unchanged.

From repository root:

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-24-tangentline-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

No modifications to existing production files or prior tests.
