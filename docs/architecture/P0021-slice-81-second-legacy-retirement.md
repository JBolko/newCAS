# P0021 Slice 81 — Retire two obsolete source-function adapters

## Scope

Retire `create-source-literal-function-task-evaluator.js` and `create-source-variable-function-task-evaluator.js`, with their **direct, obsolete adapter-API unit test files** `p0021-positional-function-evaluation.test.mjs` (7 tests) and `p0021-source-variable-function-task.test.mjs` (7 tests). The active DocumentRuntime attested Semantic IR route was installed in Slice 76 and stress-tested in Slice 77. Existing active-IR tests cover supported positional binding, shadowing, captures, argument calculation, composed functions, stale protection and task isolation. Historical *restrictions* specific to adapters are not preserved as requirements.

`create-bound-function-task-evaluator.js` remains because `tests/browser/p0021-function-worker-smoke.mjs` still imports it; removing it would break a real browser boundary witness. Migrate that browser path first in a later slice.

This is a source/test deletion, not an evaluator enhancement. No P0005, P0020, DocumentRuntime or Worker contract changes.

## Integration and reproducibility

The archive includes a PowerShell retirement script because `Expand-Archive` does **not** delete repository files. It validates active IR prerequisites and checks for remaining source/test imports before deletion, aborting if unexpected consumers are found. The two updated static audits now require the actual retired files to be absent without requiring defunct unit-level consumers.

Run `tools/migrations/p0021-slice-81-retire.ps1` after extracting, then `tools/migrations/p0021-slice-81-verify.ps1`. The latter requires both `node --test` and the complete Python standard-library unittest discovery from `tests/python`. Do not call the complete slice accepted until both suites pass. Explicitly note that the available reconstructed checkout contains only JS test materials; Python suite was **not run locally**.

## Test-count accounting

Previous verified baseline: 925 JS tests. Retired two historical test files (7 + 7 = 14 tests), added two retirement guard tests; expected new count **913**, assuming no other changes. A lower count is intended; retaining outdated API-specific tests solely to maintain the count is not a goal.

The full selected Pyodide browser smoke is unchanged; no new real-worker browser execution was performed in this slice.
