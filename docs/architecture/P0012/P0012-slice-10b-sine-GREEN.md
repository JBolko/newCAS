# P0012 Slice 10b — selected sine operation GREEN

## Scope and evidence

The preselected `probe.scalar.sin` evaluator now supports one `value` argument,
explicit `options.angleUnit = "deg" | "rad"`, exact and approximate values,
plus symbolic expressions. All ten existing Slice 10 RED tests passed locally,
alongside 37 preceding P0012 tests (**47/47**). The new handler and helper
leave P0011 and existing binary handlers untouched.

## Key decision: no implicit angles in the evaluator

Degree mode is converted by `angle * pi / 180` in the sine handler;
radian mode passes the operand unchanged. DocumentRuntime (future integration)
should supply the document setting, defaulting to `deg` as separately agreed.
The evaluator does **not** guess a missing setting. `sin(x)` in DEG is a
symbolic call over a scaled argument, not the same expression as RAD `sin(x)`.

## Boundary of abstraction

A small `_unary_value_contract.py` validates a selected unary handler's
request/spec identity, binary-independent signature shape, role, arity, and
public Value kind. It shares the existing P0009 failure-envelope constructor
with the binary helper. It does not select handlers or create a registry.

`sin`, `cos`, `exp`, and natural `log` may share a future unary execution
lifecycle, but **only trig functions need angle conversion**. `log` as the
public input spelling means base-10 in newCAS, while the current P0011
internal `log` call node still denotes natural logarithm. Do not conflate them.

## Checks from repository root

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-10b-sine-GREEN.zip" -DestinationPath "." -Force
python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
python -m unittest discover -s tests/python -p "test_p0011_*.py" -v
node --test
```

Expected P0012: **47** tests; existing P0011: 29+9 tests, subject to local
suite organization; JavaScript: previously 323. No Pyodide integration has
been newly verified for this slice.

## Future follow-up

- Test `cos` as the second operation before extracting a generic standard-function engine.
- Address `tan` and singularities without turning undefined values into a normal
  approximate scalar.
- Inverse trigonometry must return DEG/RAD appropriate angular results.
- Revisit contract-helper ownership before broadening to `diff` or `solve`.
