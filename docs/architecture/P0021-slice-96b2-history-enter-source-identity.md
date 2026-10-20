# P0021 S96b.2 - history Enter source identity / GREEN — 2026-10-20



Non-normative implementation/verification record. Frozen architecture and accepted ADRs remain authoritative.



## Change relative to the pre-existing uncommitted S96 baseline



- `src/js/document-runtime.js`: runtime-private WeakMap of opaque source/incarnation Symbols, exposed by `getBlockSourceIdentity(blockId)`. Tokens are ephemeral and never enter block serialization, history operations, Values or Worker transport. Existing S95n source replacement/insert objects receive fresh identity; moves retain it. Direct source publication refreshes identity before notification and restores the prior token on rollback.

- `src/js/editing/create-formula-editing-session.js`: capture base identity and exact history-acknowledged identity; reject ABA completion. Existing generation and live-object compatibility guards remain.

- `src/js/ui/create-semantic-calculate-action.js`: optional synchronous `calculate(drafts, {onSourceAccepted})` event on the history-integrated route after an applied/unchanged history result and before evaluation. Enter closes that accepted draft immediately and never revisits it on late settlement. Unchanged Enter crosses the existing history proposal guard without revision/history/redo changes.

- `tests/js/p0021-slice-96b2-ack-epoch-red.test.mjs`: retain the original two probes and add identity lifetime, rollback, delete/recreate, unchanged/redo, newer-draft protection, single-flight, callback failure, pre-publication failure, and real-runtime stale-result checks (13 total).

- New standalone browser page/module: `tests/browser/p0021-slice-96b2-history-enter.{html,mjs}`.

- New repeatable headless Chrome runner: `python tools/dev/run-s96b2-browser.py` (requires Selenium and Chrome; uses a localhost server and the production CDN-loaded Pyodide Worker).



HistorySession source is unchanged from the existing S96b.1 payload. Its content-fingerprint divergence contract remains unchanged, including its existing limitation concerning external source ABA. No FROZEN documents, parser, evaluator, scheduler, Worker implementation, persistence schema or active prototype UI wiring changed.



Non-history Enter retains its pending-until-settlement lifecycle. Calculate retains single-flight protection. Manual history.execute followed by editing.finishCommit remains supported.



## Actual validation



- Before implementation: extended 10-test RED suite: 1 PASS, 9 FAIL, 0 TODO, 0 SKIP.

- Final S96b.2 suite: 13 PASS, 0 FAIL, 0 TODO, 0 SKIP.

- Focused S95e/i/j/n/o/p and all S96 tests: 106 PASS, 0 FAIL, 0 TODO, 0 SKIP.

- Full Node v24.11.0: 1353 tests, 1345 PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled.

- Python 3.12 unittest discovery: 264 PASS, 0 FAIL, 0 skipped; TODO is not a unittest category.

- Real Chrome 155.0.8059.84, production supervised Worker/Pyodide/SymPy: 3 PASS, 0 FAIL, 0 TODO, 0 SKIP.

- git diff --check: passed.



Browser scenarios:

1. Accepted history Enter closes before asynchronous completion; actual SymPy evaluates a:=7+9 to 16.

2. Hold an actual Worker result at the test adapter boundary, Undo with a fresh host revision, open a newer draft, release the old result: outcome is stale, no abandoned Value publishes, newer draft survives.

3. Unchanged Enter closes before evaluation and preserves revision/history/redo; real evaluation returns 16.



The initial browser fixture used an unsupported bare arithmetic statement and failed with EVALUATOR_ERROR. Correcting only the test fixture to use supported definition syntax made all scenarios pass. No production evaluator change was needed. This is network-backed browser acceptance, not offline cold-start acceptance.



Commands:

```powershell

node --test tests/js/p0021-slice-96b2-ack-epoch-red.test.mjs

node --test

python -m unittest discover -s tests/python -p test_*.py

python tools/dev/run-s96b2-browser.py

git diff --check

```



## Git / preservation at GREEN verification (historical)



Branch: architecture-v1-implementation.

HEAD remains 8a7b0d47131b9004855fb64205a2fa13dde07a9d.

All existing S96a/S96b.1 source, tests, migration payloads, instructions and handover artifacts were preserved. The pre-existing deletion of claude.md.txt remains untouched. Nothing staged, committed, reset, cleaned or deleted.



Tracked diff against HEAD includes pre-existing S96 work: five paths (the pre-existing legacy-file deletion and four source modifications), 294 insertions / 169 deletions at verification. This is not the S96b.2-only diff. New/untracked test/browser/runner/report files are additional.



Rollback must reverse only the S96b.2 changes described above, preserving the earlier uncommitted S96 baseline. Migration payloads remain historical installation artifacts and were not rewritten.


## Checkpoint organization addendum

Permanent slice note: `docs/architecture/P0021-slice-96b2-history-enter-source-identity.md`.
Relocated from the root GREEN README during checkpoint preparation; the validation
above is the historical GREEN run, not a newly executed test run.
Current scope, Claude-guidance retirement and post-commit archival gates are in
`docs/Styredokumenter/S96_CLOSURE.md` and `docs/Styredokumenter/S96_POST_COMMIT_CLEANUP.md`.
The existing `claude.md.txt` deletion is now explicitly proposed for the checkpoint.
No historical migration payload or report archive is required to run permanent tests.
