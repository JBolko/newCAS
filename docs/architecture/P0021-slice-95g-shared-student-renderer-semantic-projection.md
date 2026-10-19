# P0021 Slice 95g — selected Value projection in the existing UI renderer

**Date:** 2026-10-19
**Baseline:** S94 checkpoint `296fbbe`, accepted S95a–S95f
**Scope:** UI/presentation integration only; **NOT** the real student-UI cutover
**Status:** GREEN candidate, requires Node 24 + real Pyodide browser acceptance

## Boundary and rationale

- The existing student UI imports `src/js/renderer.js` to show old CASEngine
  results. The selected S95f test UI was separately reading `Value.data.expr.value`
  from `DocumentRuntime.calculation`, effectively owning part of presentation.
- S95g introduces **one named presentation entrypoint in that same, already
  existing renderer module**: `renderSemanticCalculation(calculation, output,
  decimalOutput?)`. No new renderer, document store, semantic evaluator, or
  OperationSpec is created. There is no new architecture layer.
- The test-only S95f browser pilot now calls that entrypoint instead of
  extracting display strings from Value itself. The old `renderResult` API and
  active `src/js/main.js` remain untouched and continue to serve the legacy UI.
- The renderer consumes the **DocumentRuntime calculation projection**, not
  SymPy/Python transport objects. `Value` validation uses existing P0005's
  `isValue`; diagnostic validation uses existing P0009's `isDiagnostic`.

## Deliberately small presentation capability

| Semantic calculation | Temporary selected presentation |
| --- | --- |
| Exact integer | `= 11` (full exact string retained) |
| Rational | `= 1/3` (no rounding) |
| Approximate scalar | `≈ 1.2345` (no re-interpretation) |
| FunctionValue | `OK (function)` — no evaluation on render |
| Other valid Value / symbolic expression | `PRESENTATION_UNSUPPORTED_VALUE` |
| Invalid Value | `PRESENTATION_INVALID_VALUE` |
| Valid P0009 error | Stable diagnostic code, **no** backend message |
| Missing/contradictory diagnostic | `DIAGNOSTIC_UNAVAILABLE` |
| Idle/dirty/running/blocked | State marker only |

All of this uses `textContent`, not injected HTML or a new Value-to-LaTeX
printer. This narrow capability is **not P0031 exit**, complete Value
presentation, polished Danish i18n, or educational diagnostic guidance. Those
are separate future tasks. The old renderer's historic `innerHTML` usages have
not been changed or certified secure by this slice.

## Contract / tests

- 14 new tests: exact scalar digits, rational, approximate, FunctionValue,
  unsupported Value families, malformed inputs, P0009 error provenance,
  malicious backend messages, state markers, and the selected browser import
  graph remaining disconnected from legacy.
- Full S95a–S95f focused suite + these tests: **174/174 locally GREEN**.
- Python: **264/264 locally GREEN**.
- Local Node 22 full-suite comparison vs reconstructed unchanged S95f:
  **identical 14 failures and 3 cancellations** (development environment).
- The user's Node 24 regression and real Pyodide S95f browser acceptance are
  mandatory. Browser acceptance must also report that selected results passed
  through `renderer.js`, not the old test-only display extraction.

## Next cutover prerequisite

Before rerouting `main.js` in production, settle authoritative mapping of
student `.assignment` / `.cell` input identities to DocumentRuntime blocks
and task boundaries, the Enter/Calculate action semantics, and result/diagnosis
presentation for all Release-1 Value families. Do not run CASEngine and the
new semantic evaluator as two competing writers for the same task.
