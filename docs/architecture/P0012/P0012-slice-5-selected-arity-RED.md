# P0012 Slice 5 — selected OperationSpec arity (RED)

**Scope:** pressure-test the boundary between a *selected* OperationSpec
signature and the still deliberately binary scalar-add implementation.

## Observation

Slice 4 fixed argument names using the selected signature. The Slice 4
implementation still checks `len(inputs) != 2` **before** validating the
selected signature, and embeds `expected: [2]` independently of the metadata.
This yields a `wrong-arity` Diagnostic even when the supplied selected spec
is itself unary or ternary (which this mathematical implementation cannot
execute). Such a message misclassifies a contract mismatch as user input error.

## Requested behavior

- A supported single binary signature may report `wrong-arity` with `expected`
  derived from that selected signature's argument count.
- An unsupported unary/ternary signature is rejected as a contract/programmer
  error **before** arithmetic or arity diagnostics; it does **not** cause a
  speculative expansion to unary/ternary addition.
- Existing addition stays unchanged.
- No general signature selection, global registry, new dispatch identity,
  or P0009 code is created by this slice.

This RED deliberately uses `assertRaises(ValueError)` for incompatible
selected metadata, *not* a new public Diagnostic. That is a pressure
hypothesis to revisit when the actual dispatcher is implemented.

## Run from repository root

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-5-RED.zip" -DestinationPath "." -Force
python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
```

Expected against Slice 4 implementation: **18 total tests; 16 GREEN,
2 FAIL** (the unary and ternary selected-spec cases). No production changes.
