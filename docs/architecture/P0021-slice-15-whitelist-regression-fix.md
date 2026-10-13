# P0021 Slice 15 — whitelist regression-test correction

Slice 15 intentionally added `src/python/evaluator/scalar_multiplication.py` to the selected Pyodide runtime allowlist. The older Slice 12 test still asserted that the count was eight; it now asserts the exact nine allowed paths. This change is **test-only**: no runtime behavior or allowlist is weakened.

Run `node --test tests/js/p0021-selected-pyodide-runtime.test.mjs` and `node --test`. The expected total remains **543 JS tests**.
