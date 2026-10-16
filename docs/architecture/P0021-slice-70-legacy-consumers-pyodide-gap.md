# P0021 Slice 70 — Legacy consumers and Pyodide baseline gap

**Status:** GREEN for the bounded import inventory; **OPEN/NOT VERIFIED** for backend-version compliance.
**Requires:** Slice 68 and Slice 69. Frozen architecture unchanged. No production changes.

## Scope of evidence

Static *relative ES import/export* references are inspected under `src/js`, `tests/js`, and `tests/browser`. The five historical adapters audited in Slice 69 have no direct imports in `src/js`; unit and browser contract tests still explicitly import some. This does not prove the entire application contains no dynamically loaded callers, nor that the old CAS engine has been replaced. The test prevents direct regressions in production imports without deleting history.

## P0004 check — a real outstanding problem

`docs/architecture/P0004-version-lock-and-developer-baseline.md` explicitly selects Pyodide **314.0.7**, Python **3.14.2**, SymPy **1.14.0** for the new implementation. `src/js/evaluation/selected-pyodide-worker.js` currently references the CDN **v0.26.1**, as does legacy `src/js/cas-engine.js`. The legacy reference is permitted by P0004, but the **selected new Worker is not shown compliant**. The green test characterizes and *exposes* this gap; it is **not** a GREEN conformance claim. No CDN substitution is made here: a real browser initialization + SymPy runtime version check is required before choosing or changing a URL. A future slice should replace the characterization with a failing conformance test, then migrate the Worker and validate real Python/SymPy version and all existing browser contracts. Offline packaging remains separate.

## Next

Audit indirect/dynamic consumers as part of deletion; keep browser-contract adapter until replaced. For P0004, perform real-browser version probe and controlled migration. Then resume generalized Semantic IR evaluation.

## Windows portability correction (Slice 70 hotfix)

The original consumer detector compared a native `path.resolve()` result to a
forward-slash suffix (`/semantics/...`). On Windows the result contains native
backslashes, so the detector missed real unit/browser test imports and reported
"missing unit-level migration witnesses". The detector now normalizes
`path.relative(root, target)` to repository-style `/` before checking the
exact `src/js/semantics/<filename>` location. A small regression checks
Windows-style separators. This correction changes no production code,
architectural status, or Worker version.
