# newCAS - S96 closure / Git checkpoint handover (2026-10-20)

**Status:** Non-normative operational handover. S96a.1/a.2/b.1/b.2 accepted in the current worktree; closure review complete for this selected scope. Checkpoint prepared, **nothing staged or committed**. Read S96_CLOSURE.md for the review, TODO/SKIP disposition and exclusions.

## Verify actual repository state first

- Branch: `architecture-v1-implementation`.
- Verified HEAD: `8a7b0d47131b9004855fb64205a2fa13dde07a9d`.
- S95 implementation is already committed at `9aa6ab0`; HEAD adds handover/ignore changes.
- Four S96 production files remain modified against HEAD: DocumentRuntime, HistorySession, FormulaEditingSession and Calculate/Enter.
- ROADMAP_AKTUEL.md is updated for closure. S96 tests, browser acceptance, developer tools and current reports/instructions are still untracked until authorized checkpoint selection.
- The deletion of `claude.md.txt` pre-dates this work and is now explicitly included in the proposed checkpoint as retirement of obsolete project instructions. It is the only allowed missing tracked path; stage it only after the revised allowlist is approved.
- Do not create a fresh worktree from HEAD and assume it contains S96. Preserve all uncommitted work and historical migration files.

## Implemented selected contracts

- S96a.1: synchronous source rollback, publication/reentrancy guards and semantic observer isolation.
- S96a.2: semantic multi-source Calculate uses the existing S95n atomic transaction; host revision advances once, not backwards on failure.
- S96b.1: the exact pending source proposal may cross HistorySession; record one Undo entry before acknowledgement.
- S96b.2: runtime-private, ephemeral, non-reusable source/incarnation identity. History acknowledgement rejects later ABA; Undo/recreation never revives old identity. Moves and calculation-only changes preserve identity.
- Accepted history Enter closes its draft synchronously before asynchronous Worker completion. Late success/failure never touches a newer draft. Evaluation failure preserves accepted source/history; no implicit retry or replay.
- Unchanged Enter preserves revision/history/redo and still evaluates. Non-history Enter and Calculate single-flight remain.
- No new document model, evaluator, scheduler, legacy fallback, parser or persistence schema. No normative files changed.

## Actual evidence

- Node v24.11.0 full suite: **1345 PASS, 0 FAIL, 7 TODO, 1 SKIP**, 1353 tests, 0 cancelled; repeated at closure with the same counts.
- Python full discovery: **264 PASS, 0 FAIL, 0 SKIP** (GREEN implementation turn).
- S96b.2: **13 PASS**. Focused S95/S96: **106 PASS**, zero FAIL/TODO/SKIP.
- Chrome 155.0.8059.84 with production supervised Worker/CDN Pyodide/SymPy: **3 PASS, 0 FAIL/TODO/SKIP** (GREEN implementation turn): early release with actual result 16, stale delayed result after Undo/newer draft, unchanged Enter preserving redo.
- Closure strict diagnostic run: **34 PASS, 7 FAIL, 0 TODO/SKIP**, exactly the seven known TODO expectations promoted by PILOT_STRICT=1 and NEWCAS_S90_REQUIRE_ACTIVE=1. This is diagnostic evidence, not a regression-suite PASS.
- SKIP is real-symlink creation EPERM on Windows. The portable linked-file/parent-directory guard tests pass. It is not a missing parser-sync check.
- Network-backed browser proof does not establish offline cold-start or a complete normative browser matrix.

## Open risks and next recommended priority

1. **Next slice proposal:** HistorySession content-fingerprint divergence and authoritative edit routing. Both HEAD and current S96 accept Undo after external source ABA or same-ID recreation with identical content. This is a known pre-existing limitation, not fixed by EditingSession's source identity. Scope and RED tests must be reviewed before any implementation. General mixed direct/history editing is not accepted for student release.
2. Six actual pre-existing language/binding/security failures remain: F7 symbolic target/dummy binding (2), F8 substitution/scientific-notation/literal-precision (3), F4 hostile unit grammar (1). Treat as release gates where applicable; S96 does not close these capabilities.
3. The seventh TODO requests active multi-statement behavior outside frozen FormulaBlock v1 / ADR-0006. It is a deferred extension requiring a versioned ADR, not a reason to implement sequential blocks implicitly.
4. Direct primitive structural rollback under injected failures, public mutable blocks, all-task/text/settings history, active student UI cutover, legacy retirement and offline packaging remain outside S96 closure.

## Checkpoint preparation

- Exact file list: `tools/dev/s96-checkpoint-allowlist.txt` (23 paths; includes itself and the explicit legacy-instruction deletion).
- Never use `git add .` or `git add -A`.
- Keep six permanent S96 test files even where names still contain RED; all are GREEN now.
- Preserve browser fixtures and permanent developer tools. Exclude every S96 migration installer/cleanup/payload, eight obsolete package readmes, ZIP/backups/logs/Repomix/temp artifacts. The pre-existing legacy-instruction deletion is now explicitly included.
- After explicit user authorization: review the allowlist against current status, stage exactly those paths, inspect staged diff and run `git diff --cached --check`; only then perform the separately authorized commit. Record the actual new hash afterward.
- Suggested title: `P0021 S96: close history Enter and retire legacy project instructions`.
- No commit/push/release/reset/clean/deletion is authorized by this handover.

## Revised organization and staged approval gates

- Permanent GREEN evidence: `docs/architecture/P0021-slice-96b2-history-enter-source-identity.md`, relocated from the root README.
- Proposed deletion: `claude.md.txt`; no active code/test dependency found. AGENTS.md preserves current workflow safeguards. Legacy runtime retirement itself remains open.
- Staging is pending explicit approval of the revised 23-path allowlist. After staging, require exact set equality with `git diff --cached --name-only`, review the complete staged diff, and pass `git diff --cached --check`. Then stop again; no commit authorized.
- Commit requires separate explicit approval. Artifact archival requires a further separate approval after that commit.
- Read `S96_POST_COMMIT_CLEANUP.md`; its archive manifest contains 71 literal temporary file paths, not a blanket directory permission. No archive operation has run.
- After approved archival, rerun Node/Python/browser checks with original payload locations absent and require empty `git status --porcelain=v1 --untracked-files=all`. S97 must use committed permanent sources/tests/tools; never reinstall S96 ZIPs or old payloads.
