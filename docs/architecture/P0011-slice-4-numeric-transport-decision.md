# P0011 Slice 4 — approximate numerical Value transport decision

**Status: adopted for P0011 Slice 4, subject to full-repository and Pyodide verification.**
**Scope:** compatible clarification of the P0005 approximate-expression representation; no alteration of the frozen v1.0 architecture.

## Public representation

A finite approximate scalar is encoded as:

```json
{"op":"approx","value":"4333333333333333481363069950020872056484222412109375e-52","precisionBits":53}
```

- `value` is a decimal encoding of the stored finite approximation **without display rounding**. It is an exact decimal description of the approximation, not a claim that the measured/calculated quantity is exact.
- `precisionBits` is a positive safe integer describing the binary *working precision of the represented approximation*. It is neither significant figures nor guaranteed numerical accuracy.
- A SymPy Float can be converted into its exact finite dyadic rational and rendered as a finite base-10 value. This conversion is confined to the disposable adapter. No SymPy internal handle leaks into the Value.
- A roundtrip with `precisionBits` must reproduce both the stored finite approximate value and the declared precision. This is an adapter transport requirement, not a numerical-algorithm correctness claim.
- Presentation rounding and non-authoritative display caches remain separate; display caches are allowed to be lossy.

## Compatibility

Preexisting `{"op":"approx","value":"0.1"}` is **still valid** under Value v1. The P0011 SymPy adapter interprets an unannotated legacy decimal with 53-bit working precision. Adapter exports always provide `precisionBits`. The old and normalized new payloads are not required to be bytewise identical, but represent the same finite approximation after adapter import.

The added field is optional for compatibility, and validation rejects invalid precision values and malformed/nonfinite decimal text. This avoids breaking existing tests and document payloads; a future format-version revision can reconsider whether precision must become mandatory.

## Boundaries

Do not mistake `precisionBits` for numerical error estimates, accuracy of regression coefficients or conditioning of algorithms. P0012/P0017 own numerical algorithm choices. P0034/P0035 own persistence/cache policy. The public schema contains no SymPy `_mpf_`, `srepr`, or Dummy identity.

## Verification

Run from repository root after extraction:

```powershell
python -m unittest discover -s tests/python -p "test_p0011_*.py" -v
node --test tests/js/p0011-numeric-precision-value.test.mjs
npm test
```

Python pressure corpus: 29/29 green locally against SymPy 1.14.0. JS numerical Value tests: run as specified. Confirm the pinned Pyodide environment separately before final P0011 closure.
