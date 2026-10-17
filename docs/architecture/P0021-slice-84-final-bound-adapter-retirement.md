# P0021 — Slice 84: retirement of last historical bound-function adapter

## Decision

The real Pyodide Worker acceptance of Slice 83 (confirmed by the user: 919 JS, 258 Python and browser PASS) supersedes the Slice 33 browser demonstration and Slice 32 historical API-only unit tests. **Remove historical code, not semantic guarantees.**

This slice deletes four artifacts via an explicit idempotent PowerShell migration script: the historical `create-bound-function-task-evaluator.js`, its six unit tests (`p0021-bound-function-batch.test.mjs`), and the original browser smoke HTML/MJS. The real active-IR Worker test from Slice 83 is retained. The legacy `evaluate-bound-source-function-call.js` and other lower-level primitives are **not** part of this deletion; they require a separate whole-repository dependency audit before retirement.

Three existing tests that temporarily required the old adapter are updated to verify the new post-migration state. Two new architecture tests verify retirement and retention of the real Worker contract. No production calculation behavior changes.

## Acceptance gate

1. Install ZIP from repository root, run `tools/migrations/p0021-slice-84-retire.ps1`; it scans `src` and `tests` for unreviewed direct imports and fails before deletion if any remain.
2. Run `tools/migrations/p0021-slice-84-verify.ps1` (full JS and Python tests).
3. S83 real-browser acceptance already passed before deletion. Repeat the S83 browser test if Worker code changes or if an additional end-to-end confirmation is wanted.

The expected JavaScript count from the verified 919 baseline is **915**: six API-only tests removed and two architecture tests added. Python baseline remains 258. The browser count is not included in `node --test`.

The original S32/S33 contract and browser code remain accessible in Git history. Do not resurrect those APIs merely to keep their old tests.
