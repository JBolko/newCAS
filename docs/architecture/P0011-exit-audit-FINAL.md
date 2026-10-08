# P0011 — SymPy Value adapter — exit audit

**Status: COMPLETE / GREEN for the implemented Release-1 ExpressionValue bridge.**
**Date:** 2026-10-08.
**Normative:** frozen architecture v1.0; P0005, P0006, P0010 contracts.

## Verified evidence

- Python desktop: **29/29** adapter tests (reported by user).
- Browser Pyodide **314.0.7**, Python **3.14.2**, SymPy **1.14.0**: **29/29** tests (reported browser output; actual adapter and five test files loaded).
- Full Node test discovery, `node --test`: **323/323** (reported by user). The earlier 308/323 discrepancy was a restricted glob, not missing tests.
- Separate numeric transport probe: **7/7** (reported by user).

These numbers are evidence of these runs, not promises about later changes.

## Implemented contract

- Adapter-local, disposable mapping of P0006 SemanticIdentity to backend symbols, preserving distinct identities with equal display spelling; rejects alien SymPy symbols, including nested expressions.
- P0005 `expression` nodes: integer, rational, approximate, symbolRef, add, mul and pow, with backend simplifications allowed if mathematical meaning is preserved.
- Finite numeric approximations encoded as a non-display-rounded decimal value plus optional `precisionBits`. Newly exported floats carry precision; legacy decimals without it remain valid and are imported with 53-bit working precision. Representation precision does **not** certify correct significant digits.
- Backend lifetime independence of serialized Values; caches are never the source of mathematical document authority. A lossy *display-only* cache is permissible.

## Explicit boundaries / deferred work

`constant` and `call` expression forms are **not** implemented in this adapter slice. They must be addressed on demand by subsequent operation work (especially P0012) before claiming those operands are supported. Similarly FunctionValue, RelationValue, SetValue, List/Vector/Matrix and QuantityValue paths are **not** validated by this closure and must be assessed in their respective roadmap phases. P0011 closure here means the **implemented ExpressionValue foundation**, not universal Value-family coverage. Do not silently coerce unknown forms or infer identities from names.

The Pyodide test is an isolated browser-runtime adapter test; end-to-end integration with DocumentRuntime is future work.

## Numerical decision

See `docs/architecture/P0011-slice-4-numeric-transport-decision.md` for the permanent, detailed contract. This clarifies the explicit-representation-policy opening in P0005 without changing the frozen architecture.

## Permanent regression tests

`tests/python/test_sympy_value_adapter.py` combines the previous five slices **without changes to their assertions (module-level helpers are namespaced)**. Verify 29 passing tests from this new file before deleting the five historical test modules, otherwise discovery will run 58 tests.

## Closure/commit checklist

1. Install ZIP into repo root; run `python -m unittest tests.python.test_sympy_value_adapter -v` (or discovery with `-p test_sympy_value_adapter.py`) and `node --test`.
2. Run `tools/maintenance/p0011_finalize_tests.ps1` as preview, then `-Apply` *only after* the new 29-test suite is green. The script only removes files that exactly match the consolidated slice test sources as embedded in the closure manifest.
3. Ensure `git status --short` contains the expected code, test and architecture changes. Keep `package.json` changes separate if desired; do not commit delivery ZIPs or intermediate notes by accident.
4. Mark P0011 COMPLETE/GREEN in `docs/Styredokumenter/ROADMAP_AKTUEL.md`; advance next task to P0012. Do not blindly overwrite a possibly updated roadmap.

## Result

**P0011 ExpressionValue core bridge meets its bounded exit criteria, including the pinned browser runtime.** No additional speculative adapter functionality is required before starting P0012.
