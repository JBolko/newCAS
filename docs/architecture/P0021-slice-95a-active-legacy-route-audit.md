# P0021 Slice 95a — bounded legacy migration audit

**Date:** 2026-10-18
**Baseline:** S94 checkpoint `296fbbe` on `architecture-v1-implementation`
**Scope:** static routes, reproducible audit tool, safeguards for report archiving
**Production changes:** none

## Why this slice exists

S94 hardened the selected Worker, but hardening a route does not establish
that the student UI uses it. A narrow, executable audit must identify the
remaining direct legacy dependencies **before** any UI cutover or retirement.

The audit tool `tools/analyze/p0021-s95a-legacy-route-audit.mjs` traverses
bounded **static relative JavaScript import/reexport graphs** rooted at:

1. `src/js/main.js` — current UI JavaScript entrypoint (confirm HTML wiring separately).
2. `src/js/evaluation/selected-pyodide-worker.js` — selected Worker entrypoint.
3. `tests/browser/p0021-slice-83-active-ir-worker.mjs` — selected real-Pyodide browser test.

It also checks the continued presence of legacy delegate APIs, Python task
scope, and the release block; the audit **does not** evaluate them.

## Observations in the reconstructed, S94f-tested code

| Check | Observed |
|---|---|
| UI import graph | `src/js/main.js` reaches `cas-engine.js`, `transformer.js`, `python-files.js`, `legacy/compile-legacy-unit.js` |
| Selected Worker graph | No static relative import to the four inventoried legacy JS modules |
| Real selected browser-probe graph | No static relative import to those legacy JS modules |
| DocumentRuntime | Still defines `calculate`, `getTaskState`, and `resetTask` delegation into injected legacy engine |
| Python | `bootstrap.py`, `core/executor.py`, `core/scope.py` still support `run_in_task`, `eval`, and task registry |
| Release | `student-preview.mjs` still blocks student release, correctly |

On this audit's bounded graph the UI reaches 9 JS modules, the selected Worker
7, and the real browser probe 43; these are **not** counts of active product
capabilities. The source test alone does not prove `index.html` uses the
expected UI entrypoint, nor does it prove any runtime handler exercised a route.

## Explicit migration steps to establish next

1. **95b — UI cutover readiness contract:** inspect actual `index.html` and UI
   events, document source/Value/result/diagnostic/presentation mapping, and
   identify precise routes needing migration. Preserve edit/source authority in
   DocumentRuntime. Do **not** switch the UI without real browser/Pyodide proof.
2. Map the public `DocumentRuntime.calculate/getTaskState/resetTask` consumers;
   retire legacy compatibility APIs only after equivalent consumers are moved.
3. Map Python `run_in_task`, `task_registry`, `ScopedGlobals`, reset and
   `bootstrap.py` consumers, including historical tests and packaging inputs.
4. Update browser smoke tests for the **actual** user entrypoint. Compare
   production path coverage; do not assume test-only selected Worker wiring
   migrates the UI.
5. Preserve the release block while any known legacy entrypoint remains.

## Limits and constraints

- Bounded static imports; `import()`, Worker URL constructors, HTML script tags,
  Python imports, runtime event handlers and indirect resource loads are *not*
  proven by this tool. It is a migration planning aid, not a security proof.
- Absence from a static import graph does not justify deletion of any module.
- No runtime/evaluator/scheduler duplication, no Python code generation, no
  change to P0001–P0011 frozen architectural contracts.
- The release allowlist remains development-preview only.
- Real Pyodide browser evidence remains required for relevant cutover slices
  and before major checkpoints, not for this audit-only slice.

## Verification and artifacts

- `node --test tests/js/p0021-slice-95a-legacy-route-audit.test.mjs` — seven
  tests of bounded reachability, negative import fixtures and report limitations.
- `node tools/analyze/p0021-s95a-legacy-route-audit.mjs` — human-readable report.
- `node tools/analyze/p0021-s95a-legacy-route-audit.mjs --json` — machine-readable report.
- `tools/migrations/p0021-s95a-verify.ps1` — Node 24, seven focused tests,
  parser sync and full JS/Python regression in a ZIP log.
- `tools/migrations/p0021-s95a-archive-untracked.ps1` — preview-first,
  *move-only* archival of known untracked S86–S94 test results and S94 one-shot
  inputs to a sibling folder; never deletes, overwrites, or moves tracked code.

**Acceptance is evidence for the audit only.** No legacy route is retired in 95a.
