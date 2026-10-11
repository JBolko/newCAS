# P0012 Slice 9 — power GREEN, including exact vs approximate exponent

**Scope:** preselected binary scalar power; no new registry or public dispatch ID.

The handler `src/python/evaluator/scalar_power.py` reuses the private
`validate_binary_expression_request` from Slice 8 and the disposable P0011
SympyValueAdapter. The only mathematical kernel is `base ** exponent`.

The seven original RED tests plus two added tests distinguish:

- `2 ** (1/2)` where exponent is a rational Value: exact `sqrt(2)`
  represented as a symbolic `pow` Value;
- `2 ** 0.5` where exponent is an approximate Value: approximate
  result, not silently converted to `sqrt(2)`.

A decimal literal being exactly representable as a binary Float does NOT
change its `approx` semantics to `rational`.

The fixture evaluator ID `probe.scalar.power` is internal to this slice.
No automatic expansion of symbolic powers or numerical stability promises
beyond the existing P0005/P0011 contract are introduced.

From repo root, with the RED ZIP already extracted:

    Expand-Archive -LiteralPath .\P0012-slice-9-power-GREEN.zip -DestinationPath . -Force
    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
    python -m unittest discover -s tests/python -p "test_sympy_value_adapter.py" -v
    node --test

Expected P0012: 37 tests (28 existing + 7 original power + 2 additional).
Remaining baselines: P0011 29 and JS 323, to be verified by user.
