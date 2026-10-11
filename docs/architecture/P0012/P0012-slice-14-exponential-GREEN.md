# P0012 Slice 14 — exp (GREEN)

**Purpose:** A first ordinary standard function without DEG/RAD requirements.

- New selected handler: `src/python/evaluator/scalar_exponential.py`.
- Uses existing `_unary_value_contract.validate_unary_value_request`.
- Keeps the handler-specific `probe.scalar.exp` capability explicit; not a dispatch registry.
- Requires `options: {}`; angle mode belongs only to trigonometric operations.
- Uses disposable `SympyValueAdapter` for input/output; evaluates `sp.exp(argument)`.
- Exact `exp(0)=1`, `exp(1)=E`, symbolic `exp(x)` preserving SemanticIdentity,
  and approximate `exp(0.5)` remain distinct.
- No new adapter shapes. No P0011 changes. No changes to frozen contracts.

**10 permanent regression tests:** `tests/python/test_p0012_exponential_red.py`
(new RED-origin file now GREEN), including mismatch, arity, role and options.

**Local verification:** 80/80 P0012 tests after integrating the new test
(70 pre-existing plus 10 new). The 9 P0011 Slice 5 tests were previously
verified for Slice 13. Run complete suites on actual checkout.

**Run order (JavaScript first, full output when desired):**

```powershell
Expand-Archive -LiteralPath ".\\P0012-slice-14-exp-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

**Next:** natural logarithm `ln` operation under existing internal `log`
call semantics. User-facing `log` is base 10 but that is parser/surface
policy, not a silent reinterpretation of the internal natural `log` node.
Then `diff` with `symbolic` role and output structure pressure.
