# P0012 Slice 7 — multiplication GREEN

**Scope:** standalone preselected binary scalar multiplication handler, no registry.

File: `src/python/evaluator/scalar_multiplication.py`.

The new handler mirrors the proven selected-addition contract: matching
request/spec evaluator identity, a handler-local capability guard, one
binary signature with two ordinary `value` roles, arity derived from that
signature, argument names taken from the selected metadata, P0009-shaped
wrong-arity/type-mismatch/unsupported-operation failures, and P0011
translation using a single disposable SympyValueAdapter per request.

Mathematical kernel: `left * right` only.

The temporary `probe.scalar.multiply` evaluatorId is not a final
public operation-registration decision.

**No shared-helper extraction in this slice.** Duplication with addition
is deliberate pending joint review and further operations. Do not
interpret this as an endorsement of permanent copy/paste.

From repository root:

    Expand-Archive -LiteralPath .\\P0012-slice-7-multiplication-GREEN.zip -DestinationPath . -Force
    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
    python -m unittest discover -s tests/python -p "test_sympy_value_adapter.py" -v
    node --test

Expected P0012: 28 tests (22 previous + 6 new). Existing baselines:
29 adapter Python; 323 JavaScript. Those totals must be verified
on the user's current checkout.

The six new tests are in the already installed Slice 7 RED file,
so the GREEN archive contains no duplicate test or modification.
