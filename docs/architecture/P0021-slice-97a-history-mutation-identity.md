# P0021 S97a - runtime document mutation identity / GREEN

**Status:** GREEN in the worktree, not staged or committed. 2026-10-20.
**Baseline:** S96 commit `88a0a9bd5dcd8e341501e7fd5251f31817c9d01a`.
Non-normative implementation record. FROZEN v1.0 and accepted ADRs are unchanged.

## Accepted scope and implementation

The user approved option C delivered first as A: detect public-API mutation chronology
using an ephemeral runtime-owned document token, retaining content checks.
History-aware routing of every editor action and encapsulation of raw mutable references
remain later, separately reviewed work.

Production changes are limited to:
- `src/js/document-runtime.js`: private Symbol-backed document token;
  `getDocumentMutationIdentity()` reader; token changes on public source/order/existence writes;
  prepared plans capture and verify it.
- `src/js/editing/create-document-history-session.js`: store expected current token,
  check it plus existing ID/type/task/source fingerprint before history continuation;
  update expected token after owned execute/Undo/Redo publication and recording.

The stamp is not mathematical source/incarnation identity, calculation generation,
host revision, history cursor, persistence data, or Worker transport.
It is neither serialized into blocks nor restored from old history entries.
Undo/Redo generate fresh identities for the corresponding authoritative publications.

| Boundary | Token behavior |
| --- | --- |
| Direct `setBlockSource`, including same-text writes | Fresh document token after semantic rebuild/invalidation, before notification. Existing generation/source identity contract retained. |
| `addBlock/insertBlock/removeBlock/moveBlock` effective writes | Fresh token immediately after blocks change, before rebuild/invalidation/notifications. Covers text and other tasks. |
| Same-index move, unchanged transaction | Token unchanged; unchanged history action preserves epoch/cursor/redo. |
| Applied compound source ABA/move-back/insert-remove | Fresh token under existing plan.changed semantics, even when final content equals the original. |
| Prepare-only, invalid proposal, failure before actual structural write | Token unchanged. |
| Complete source/transaction rollback | Original accepted token retained/restored together with existing source/order/graph/calculation rollback. Earlier valid prepared plan remains valid if its original state is restored. |
| Existing direct structural throw after a blocks change | Fresh token remains; thrown method must not falsely advertise unchanged authority. No new structural rollback mechanism. |
| Calculation publication, dirtying, host-only epoch/restart | No document token change. Existing host/Worker stale-result safeguards retained. |

Prepared plans now reject structural ABA even if block references, order, source and
calculation generation have all returned to their earlier values. A host callback
that consumes an epoch and mutates then restores structure leaves the epoch advanced;
the stale plan is rejected without publishing its intended edit or history entry.

History rejects foreign public mutations before its next revision/cursor change.
Competing histories, non-history Calculate, structural actions and browser reconciliation
cannot silently restore equal text/order and continue an older owner's Undo chain.
No implicit reset/rebase, merge, automatic retry, Worker restart or replay was added.
The existing content guard still catches visible raw source edits.

## RED -> GREEN evidence

Initial S97 RED: 42 tests, **9 PASS / 33 FAIL**.
Before production implementation, added 20 permanent token/edge probes:
62 tests, **9 PASS / 53 FAIL / 0 TODO / 0 SKIP**.
They cover text add/insert/remove, other-task source ABA, same-text writes,
real no-ops, prepare/rejection, complete rollback and retained plan validity,
all four direct structural error boundaries, calculation-only state,
retained raw-content checking, and unique compound-publication identities.

Final S97 suite: **62 PASS / 0 FAIL / 0 TODO / 0 SKIP**.
The structural fault probes restore identical original block references/content
inside the test fixture to prove that the new token itself rejects stale plans.
This raw restoration is fault-injection test setup, not a new supported production path.

## Verification

| Run | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: |
| S97a | 62 | 0 | 0 | 0 |
| Focused S95e/i/j/n/o/p + S96 + S97 | 168 | 0 | 0 | 0 |
| Full Node v24.11.0 | 1407 | 0 | 7 | 1 |
| Full Python discovery | 264 | 0 | n/a | 0 |
| Existing real S96b.2 Chrome/Pyodide/SymPy | 3 | 0 | 0 | 0 |
| New real S97a Chrome/Pyodide/SymPy | 4 | 0 | 0 | 0 |

Full Node totals 1415, zero cancelled. Both canonical parser checks pass:
exact Peggy packrat source output and regenerated-parser AST equivalence.
The seven TODO remain the six known binding/grammar/precision/security gaps plus
the S90 multi-statement ADR gate. SKIP remains real Windows symlink creation EPERM.
They are not silently converted to PASS. git diff --check passes; index remains empty.

Actual Chrome version: 155.0.8059.84. New browser scenarios:
1. History Enter closes early; real SymPy returns 16; source and document identities differ.
2. A real Worker result is delayed at the test adapter boundary; foreign source ABA
   makes history fail closed without consuming an epoch/cursor. The old result is stale
   and cannot publish or touch a newer draft.
3. Actual calculation preserves document identity, and explicit fresh-owner Undo/Redo
   reevaluates to real Values 17/16 with monotonic host epochs.
4. Text insertion/removal ABA invalidates both history and a prepared source plan,
   while preserving the formula source identity.

Fixture: `tests/browser/p0021-slice-97a-history-mutation.html` and matching module.
The existing Selenium runner now accepts optional `--page` and `--result-variable`;
defaults and existing S96 page/results are preserved. This is developer tooling,
not an additional product/evaluator layer.

Commands:
```powershell
node --test tests/js/p0021-slice-97a-history-mutation-divergence-red.test.mjs
node --test
python -m unittest discover -s tests/python -p test_*.py
python tools/dev/run-s96b2-browser.py
python tools/dev/run-s96b2-browser.py --page tests/browser/p0021-slice-97a-history-mutation.html --result-variable s97aResult
git diff --check
```

Full logs are under ignored
`tools/reports/S96-post-checkpoint-88a0a9b-20261020-205305-229/`:
`s97a-extended-red.tap`, `s97a-focused.tap`, `s97a-full-green.tap`,
`s97a-python.txt`, `s97a-s96-browser.txt`, `s97a-browser.txt`.
No old installer/payload is required.

## Remaining limits and next slice

- Raw `blocks` / `getBlock()` source, ID, task or order ABA is not intercepted.
  Content checking detects visible final divergence, not arbitrary raw chronology.
- All editor mutations are not automatically history-routed. Existing non-history
  routes remain available; their public writes now invalidate stale history.
- Direct structural methods may still leave partially changed authority on internal
  failure. The token exposes this; generic rollback remains out of scope.
- Network-backed browser acceptance is not offline cold-start acceptance.
- Existing broader math, language, legacy-retirement and student-release gates remain open.

Recommended next work is a separate history-aware routing/ownership review, followed
by a separately scoped mutable-reference encapsulation design that preserves the
existing live-block/source identity compatibility. No new feature or broad cutover
is included here.

Rollback, if requested, must reverse only S97 hunks in the two production files,
preserving the S96 checkpoint and permanent tests. No staging, commit, reset, clean
or push was performed.
