# P0021 Slice 80 — first source-evaluator retirement

**Intent:** Retire three source-attested implementations superseded by the
active resolved Semantic IR batch. Preserve normative behavior, not historical
API compatibility or inflated test counts.

## Actual retirement (must run migration script)

- `create-source-integer-assignment-task-evaluator.js`
- `create-source-expression-task-evaluator.js`
- `create-source-composed-expression-task-evaluator.js`

These have no remaining direct production or dedicated historical test imports
in the audited checkout, unlike the three still retained adapters below.
ZIP extraction cannot remove existing files: run
`./tools/migrations/p0021-slice-80-retire.ps1` in PowerShell from project root.
The script checks the IR prerequisites before any deletion and can be rerun.
Commit the resulting deletions with the slice.

## Deliberately retained

- `create-source-literal-function-task-evaluator.js` (older direct tests)
- `create-source-variable-function-task-evaluator.js` (older direct tests)
- `create-bound-function-task-evaluator.js` (browser + direct tests)
- `create-source-function-definition-task-evaluator.js` (ACTIVE; not legacy)

Active IR scenarios are already tested through DocumentRuntime in Slice 76/77.
Tests for distinct normative constraints remain; there is **no** adapter
compatibility layer or replacement for obsolete historical APIs.

## Accounting

Two new S80 tests; an existing S69 audit is changed, with no net test count
change in that file. Expected baseline 923 -> 925 total Node tests, provided
Slices 75–79 are present and the retirement script is executed.
Full checkout regression and browser suite must be verified on the user's machine.
