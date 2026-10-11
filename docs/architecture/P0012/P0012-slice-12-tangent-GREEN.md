# P0012 Slice 12 — tangent with exact poles

This is a **bounded selected-handler slice**, not a universal standard-function dispatcher.

## Changes

- P0012 `evaluate_tangent_request` in existing `scalar_trigonometry.py`.
- P0011 finite public `call` allowlist gains `tan` in both directions; does not generalize to all SymPy calls.
- 12 new tests in `test_p0012_tangent_red.py`.
- Uses the existing `validate_unary_value_request` helper; sine/cosine entry points unchanged.

Exact poles such as `tan(90 deg)` and `tan(pi/2 rad)` produce a structured
failure with provisional code `undefined-result` and `operationId`; SymPy `zoo`
never crosses the Value boundary. **Verify that `undefined-result` belongs to
P0009's canonical diagnostic vocabulary before declaring this API permanent.**
If it does not, adopt the normative code in a distinct contract-alignment slice.

Near-pole approximate inputs are evaluated numerically without any
`abs(cos(x)) < tolerance` threshold. A float can still round onto a pole;
this is a numerical policy question reserved for later pressure tests.
No implicit angle-unit default is introduced.

## Architecture finding

Sine/cosine currently share unary request validation but each repeats option
checks, degree conversion, adapter invocation, and result envelope construction.
Tangent repeats them too plus its pole handling. This is now enough evidence
to consider an explicit shared **trigonometric evaluator** in a later
refactoring slice. A universal standard-function registry is **not** yet
justified: `exp` and `ln` are not angle-aware and `tan` has domain behavior.

## Verification

From repo root after extraction:

```powershell
python -m unittest discover -s tests/python -p "test_p0012_tangent_red.py" -v
python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
python -m unittest discover -s tests/python -p "test_p0011_*.py" -v
node --test
```

12 local new tests pass; full repo regression including locked Pyodide
should be checked before checkpoint closure.
