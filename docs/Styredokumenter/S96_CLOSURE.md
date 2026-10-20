# S96 closure and proposed Git checkpoint - 2026-10-20

Non-normative review. The frozen v1.0 specification, normative stress tests, review resolution and accepted ADRs remain authoritative. This closes only the accepted S96 slice scope, not P0021/P0026/P0027/P0028 or student release.

## Decision and baseline

S96a.1, S96a.2, S96b.1 and S96b.2 are ready for a **scoped development checkpoint**, subject to explicit user authorization for staging and commit. No new S96 regression or unapproved semantic change was identified in the reviewed changes. Existing language/binding/security gaps and history integration limitations remain release gates, individually recorded below.

Verified branch: `architecture-v1-implementation`.
Verified HEAD: `8a7b0d47131b9004855fb64205a2fa13dde07a9d`.
S95 implementation checkpoint: `9aa6ab0` (already committed).
Nothing staged or committed. The permanent GREEN note has been relocated within the repository; no artifact cleanup, reset, clean or new deletion was performed.

## Complete change inventory against HEAD

Four modified source files:
- `src/js/document-runtime.js`: publication guards, source rollback, semantic observer isolation and ephemeral source/incarnation identity.
- `src/js/editing/create-document-history-session.js`: exact pending-source exception, synchronous acknowledgement after history recording.
- `src/js/editing/create-formula-editing-session.js`: acknowledged replacement block plus source-identity checks; no authoritative source/result storage.
- `src/js/ui/create-semantic-calculate-action.js`: atomic semantic multi-source publication, optional history ownership, separate source acceptance and evaluation settlement.

Permanent S96 regression files contain **36 tests**: original S96a RED (4), a.1 (4), a.2 (6), original S96b RED (3), b.1 (6), b.2 (13). RED names preserve provenance; all 36 currently pass. Two new browser fixtures and the reusable Selenium runner cover real Worker lifecycle behavior.

The revised checkpoint allowlist has **23 paths**: 4 source, 6 Node tests, 2 browser fixtures, 4 developer-tool/manifest paths, 6 workflow/evidence/closure/cleanup documents, and the explicit deletion of `claude.md.txt`. Six are tracked changes (four source, roadmap and the pre-existing deletion); seventeen are untracked additions. Complete proposed diff counts include full untracked files and the 45-line legacy-file deletion; the final review reports current totals. No files are staged.

The permanent GREEN note is now `docs/architecture/P0021-slice-96b2-history-enter-source-identity.md`, following the existing P0021 slice naming convention. It was moved from the root, not duplicated as a second authority. Its GREEN evidence is historical; the checkpoint addendum records the revised organization.

All untracked files were inventoried. The 18 S96 installer/cleanup/payload files and eight historical package readmes are temporary development artifacts and excluded from Git. They remain local until separately approved archival. Old cleanup commands must not be run: they can remove permanent GREEN regressions.

**Explicit Claude-guidance retirement is now proposed for this checkpoint:** include the already existing `claude.md.txt` deletion. The committed file describes obsolete Transformer/Python string-codegen, the old Result envelope, an obsolete parser build command and a Worker-yet-to-be-implemented status. It must not remain a project instruction. A reference search found no runtime/test dependency; remaining workflow references are retirement notices in AGENTS.md and the checkpoint documents. AGENTS.md retains the parser/Danish/presentation safeguards and names the actual retired file. This does not retire the still-active legacy evaluator code or alter normative authority.

## Normative compatibility review

| Slice / boundary | Authority / evidence | Review outcome |
| --- | --- | --- |
| S96a.1 rollback and publication | ADR-0006 atomic rejected mutations; frozen document authority and section 19 transactions; original S96a and a.1 fault-injection/reentrancy tests | A failed source write restores source, dependencies, graph and calculation-slot references. Prepared publication cannot acquire nested public source/structure mutations from observers. Semantic observers cannot veto accepted source. No new document owner. |
| S96a.2 atomic Calculate | Frozen section 19: compound user action; ADR-0006 order, task bindings and invalidation; a.2 batch/stale-plan/rollback tests | Existing S95n transaction owns multi-source semantic publication. One host revision; failed publication never rewinds epoch. Explicit legacy compatibility remains separate, with no fallback from a semantic failure. |
| S96b.1 exact draft/history | Frozen section 4.2 and section 19; S95o/n regressions and b.1 tests | Only the exact pending single-source proposal can cross the active-draft history guard; record reversible operations/cursor before ACK. Undo/Redo stay blocked by live drafts. No cached Values/backend snapshot restored by history. |
| S96b.2 identity and early release | Frozen section 18.1; review resolution 2.11/2.13; stress tests 31/32/50/52; explicitly accepted lifecycle decisions; 13 Node and 3 browser scenarios | Runtime-owned Symbol identity is separate from host revision and calculation generation, not serialized or restored by Undo. ACK rejects later source ABA. Late settlement cannot close/retry another draft. Non-history pending lifecycle and Calculate single-flight retained. |
| ADR-0004/0005 ownership/persistence | Runtime owns source/order/dependencies; UI owns interaction; submitted state frozen | No Worker/IR/Value/evaluator authority changes, no persistence/submission schema changes. Runtime tokens and history stay ephemeral. |
| Parser / diagnostics / backend separation | Frozen writer boundary and immutable Values; P0005-P0010 contracts | No generated parser/grammar edit, no legacy Python string-codegen in the selected route, no new evaluator/scheduler. Incomplete committed source remains document data. ADR-0006 rejected-input atomicity is not used to override frozen parse-invalid-writer behavior. |

This is a compatibility review of the changed scope, **not proof of complete implementation of every frozen stress test**. Direct primitive structural rollback under injected failures, public mutable block exposure, all-content/task history, legacy retirement, capability breadth, diagnostics localization and offline packaging remain outside S96 acceptance.

Frozen documents and accepted ADRs have zero diff against HEAD.

## Actual verification and classification of all TODO/SKIP

| Run | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: |
| Node v24.11.0 full, repeated during closure | 1345 | 0 | 7 | 1 |
| S96b.2 focused (GREEN turn) | 13 | 0 | 0 | 0 |
| S95e/i/j/n/o/p plus all S96 (GREEN turn) | 106 | 0 | 0 | 0 |
| Python unittest discovery (GREEN turn) | 264 | 0 | n/a | 0 |
| Chrome 155.0.8059.84 real supervised Worker/Pyodide/SymPy (GREEN turn) | 3 | 0 | 0 | 0 |
| Strict diagnostic selection during closure | 34 | 7 expected known gaps | 0 | 0 |

Full Node totals **1353**, including seven failing TODO probes; no cancelled tests. The strict diagnostic used `PILOT_STRICT=1` and `NEWCAS_S90_REQUIRE_ACTIVE=1` on the S90 statement-order test and pilot binding/language tests. It confirms that every TODO is an actual failing expectation, not a dormant passing test. These flags were process-local and are not set in normal repository configuration.

| # | Exact gap / source | Actual failure and classification | Checkpoint / release disposition |
| --- | --- | --- | --- |
| 1 | S90 active sequential statements, `tests/js/p0021-slice-90a-statement-order-projection.test.mjs:117` | Runtime returns `Expected exactly one statement per formula block`. The requested extension is outside FormulaBlock v1 / ADR-0006, as the existing roadmap already states. | Not an S96 regression or an authorized v1 acceptance requirement. Keep visibly deferred; require a versioned ADR before implementing or reclassifying this test. Do not claim multi-statement support. |
| 2 | F7 stress #16 diff target, `tests/pilot/lib/binding-cases.mjs:77` via binding-stress | `diff(x^2,x)` projection still reports document provider x. This is deriveSemanticTask binding metadata, using a throwing legacy stub; it is neither a legacy execution test nor proof of real SymPy failure. It can affect dependency/blocking correctness. | Existing normative symbolic-binding gap; blocks complete relevant P0019/P0021 release acceptance. Selected attested compiler successes do not close this projection probe. |
| 3 | F7 stress #18 dummy variable, `tests/pilot/lib/binding-cases.mjs:81` | `sum(k^2,k,1,3)` projection binds k to document provider k. Same metadata route and false dependency risk as #2. | Existing normative dummy-scope/capability gap. Close through role-aware document/evaluator integration and actual browser cases before claiming supported symbolic scope behavior. |
| 4 | F8 substitution, `tests/pilot/04-language-and-parser-sync.test.mjs:45` | Parser rejects `f(2) \| a=7`. Grammar/capability missing; not a source-commit/history defect. | Existing substitution capability gate. Frozen substitution semantics remain; exact surface syntax needs its own explicit grammar decision and canonical tests. |
| 5 | F8 scientific notation, same file :51 | `1e3` silently parses as `1*e3`. Ambiguous input behavior is real, not an implemented scientific-notation feature. | Existing student-input correctness release risk; explicit notation/rejection policy and parser tests needed. S96 does not change it. |
| 6 | F8 literal precision, same file :59 | AST literal becomes `0.12345678901234568`, losing original digits. | Existing exact-number preservation release blocker for affected input; fix source-to-Value precision contract in a separate grammar/evaluator slice. |
| 7 | F4 unit grammar, same file :71 | Hostile unit text such as `__import__(...)...` is accepted by the parser. This test proves acceptance, not code execution in the selected Worker. Active legacy codegen makes containment/retirement a separate serious release gate. | Existing grammar/legacy-security release risk. Do not call it harmless or claim RCE based solely on this probe; require restricted unit syntax and active-route security/retirement evidence. |
| SKIP | S89b real-symlink test, `tests/js/p0021-slice-89a-student-preview-allowlist.test.mjs:94` | Windows cannot create the symlink: EPERM. Portable mocked linked-file and linked-parent guard tests pass. Parser sync is executed and is not this SKIP. | Environment-specific real-filesystem coverage gap, not S96 functionality. Obtain real-symlink evidence on a permitted host before final release packaging acceptance; no blanket waiver for unknown skipped tests. |

Six TODO are actual existing binding/language/security gaps; the seventh is a future extension gate. None counts as PASS. Standard suite green means zero unmarked failures, not full release acceptance.

Canonical parser equivalence runs as part of full Node; no manual regeneration was performed. Browser proof uses the production module Worker and real SymPy Values but only three lifecycle scenarios and network-backed CDN loading, not offline cold-start or all symbolic/normative cases. The permanent PowerShell log collector was statically reviewed; it was not executed during closure, and it creates only development reports when explicitly used.

## History divergence risk and next recommended slice

Reproduced entirely in memory with the current DocumentRuntime and both:
1. `create-document-history-session.js` loaded from committed HEAD using `git show`;
2. current S96 HistorySession.

Scenario A: history changes source 1 -> 2; direct writes 2 -> 3 -> 2; Undo returns `applied`, source 1.
Scenario B: history changes source 1 -> 2; direct removal/recreation of same ID/task/source 2; Undo also returns `applied`, source 1.
Both versions advance history's host epoch to 2. The history implementation at HEAD has the same behavior; this is **not a newly introduced regression**. Content equivalence is insufficient to detect the intervening mutation chronology/incarnation.

S96b.2's token protects an EditingSession ACK. It does **not** make HistorySession's global fingerprint incarnation-aware, and strengthening that contract was explicitly excluded from S96b.2.

**Assessment:** safe to record the selected S96 development checkpoint with this explicit limitation; **blocks a general mixed-route editor-wide Undo/Redo release claim** until closed or eliminated by an accepted enforced edit-routing contract. Existing prototype/non-history mutation paths make it a real integration risk, not merely a theoretical attacker case. The current selected path still guards real stale Worker publication by revision, block/source/generation and run lease; the browser Undo proof passed. Do not conflate history chronology with stale-result publication.

**Next slice proposal (not implementation approval):**
- First define RED expectations for external ABA, same-ID recreation, insert/remove/move and compound net-no-op chronology, acknowledgement/callback failure and mixed authoritative edit routes.
- Review an opaque runtime-owned mutation/incarnation stamp versus enforced all-edit routing. Do not reuse host revision (which can advance on Worker restart) or calculation generation (which changes for invalidation).
- Ensure preparation/rejected publication do not report accepted mutation; successful history execute/Undo/Redo updates expected identity only after publication. Preserve single-flight, monotonic host epochs, no-op/redo and rollback semantics.
- Route supported authoritative edit commands through the existing owner before a student editor adopts history globally. No new document mirror, evaluator, scheduler or implicit replay.
- Add real-browser mixed-route/Undo stale-result acceptance. Stop for a contract decision before changing the current divergence semantics.

## Explicit checkpoint allowlist and exclusions

Machine-readable list: `tools/dev/s96-checkpoint-allowlist.txt`, 23 repository-relative literal paths (including one approved-for-review tracked deletion), no wildcard/directory entries. This is a developer Git checkpoint list, **not** the student distribution allowlist.

- `AGENTS.md`
- `src/js/document-runtime.js`
- `src/js/editing/create-document-history-session.js`
- `src/js/editing/create-formula-editing-session.js`
- `src/js/ui/create-semantic-calculate-action.js`
- `tests/js/p0021-slice-96a-mutation-atomicity-red.test.mjs`
- `tests/js/p0021-slice-96a1-publication-guards.test.mjs`
- `tests/js/p0021-slice-96a2-atomic-calculate-batch.test.mjs`
- `tests/js/p0021-slice-96b-edit-history-red.test.mjs`
- `tests/js/p0021-slice-96b1-history-enter-contract.test.mjs`
- `tests/js/p0021-slice-96b2-ack-epoch-red.test.mjs`
- `tests/browser/p0021-slice-96b2-history-enter.html`
- `tests/browser/p0021-slice-96b2-history-enter.mjs`
- `tools/dev/collect-test-results.ps1`
- `tools/dev/run-s96b2-browser.py`
- `tools/dev/s96-checkpoint-allowlist.txt`
- `docs/architecture/P0021-slice-96b2-history-enter-source-identity.md`
- `docs/Styredokumenter/ROADMAP_AKTUEL.md`
- `docs/Styredokumenter/CODEX_HANDOVER_S96.md`
- `docs/Styredokumenter/S96_CLOSURE.md`
- `claude.md.txt`
- `docs/Styredokumenter/S96_POST_COMMIT_CLEANUP.md`
- `tools/dev/s96-post-commit-archive-allowlist.txt`

Explicitly excluded untracked files (remain local; no cleanup performed):

- `README_S96A_RESULTS.md`
- `README_S96_VERIFY_HOTFIX_003.md`
- `S96A1_GREEN_README.md`
- `S96A2_GREEN_README.md`
- `S96A_RED_README.md`
- `S96B1_GREEN_README.md`
- `S96B2_RED_README.md`
- `S96B_RED_RUN_README.md`
- `tools/migrations/p0021-s96a1-install.ps1`
- `tools/migrations/p0021-s96a1-payload/src/js/document-runtime.js`
- `tools/migrations/p0021-s96a1-payload/tests/js/p0021-slice-96a1-publication-guards.test.mjs.payload`
- `tools/migrations/p0021-s96a2-cleanup.ps1`
- `tools/migrations/p0021-s96a2-install.ps1`
- `tools/migrations/p0021-s96a2-payload/src/js/ui/create-semantic-calculate-action.js`
- `tools/migrations/p0021-s96a2-payload/tests/js/p0021-slice-96a2-atomic-calculate-batch.test.mjs.payload`
- `tools/migrations/p0021-s96b-red-cleanup.ps1`
- `tools/migrations/p0021-s96b-red-install.ps1`
- `tools/migrations/p0021-s96b-red-payload/p0021-slice-96b-edit-history-red.test.mjs.payload`
- `tools/migrations/p0021-s96b1-install.ps1`
- `tools/migrations/p0021-s96b1-payload/src/js/editing/create-document-history-session.js`
- `tools/migrations/p0021-s96b1-payload/src/js/editing/create-formula-editing-session.js`
- `tools/migrations/p0021-s96b1-payload/src/js/ui/create-semantic-calculate-action.js`
- `tools/migrations/p0021-s96b1-payload/tests/js/p0021-slice-96b1-history-enter-contract.test.mjs.payload`
- `tools/migrations/p0021-s96b2-red-cleanup.ps1`
- `tools/migrations/p0021-s96b2-red-install.ps1`
- `tools/migrations/p0021-s96b2-red-payload/p0021-slice-96b2-ack-epoch-red.test.mjs.payload`

Include only the explicitly listed `claude.md.txt` deletion. Exclude every ZIP, backup, report/testlog, Repomix dump, temporary inventory, cache, environment and one-shot verifier from Git. Never stage a whole migration/tools directory. The permanent collector and Selenium runner are individually allowed; their output ZIPs/logs are not.

Before a future authorized checkpoint, require that Git status still matches the reviewed scope, all listed addition/modification paths exist and the sole deletion is tracked at HEAD and absent locally, the staged path set equals this allowlist, and the complete staged diff plus `git diff --cached --check` are reviewed. Do not run staging commands yet. A future commit may include this explicit legacy-instruction deletion but no excluded artifact. Exact future staging checks and reversible archival steps are specified in S96_POST_COMMIT_CLEANUP.md.

## Suggested commit

Title: `P0021 S96: close history Enter and retire legacy project instructions`

Body:

```text
Guard source/transaction publication and roll back rejected source changes.
Publish semantic multi-draft Calculate atomically, and record exact pending
Enter edits through HistorySession before source acknowledgement.

Track ephemeral source/incarnation identity independently of calculation
generation and host revision. Release accepted history Enter drafts before
Worker settlement; preserve non-history behavior, single-flight, no-op redo,
and newer drafts when old evaluations settle.

Retain permanent S96 regressions, real Pyodide browser acceptance and
developer tools; place the permanent GREEN note with architecture slice notes.
Retire the obsolete claude.md.txt project instructions in favor of AGENTS.md
and unchanged frozen architecture/accepted ADR authority. Update roadmap,
handover, release-gap review and explicit post-commit archival plan.

Validation: Node 24: 1345 PASS, 0 FAIL, 7 TODO, 1 SKIP; Python: 264 PASS.
Focused S95/S96: 106 PASS. Real Chrome/Pyodide/SymPy: 3 PASS.
History content-fingerprint ABA/recreation limitation remains a separate slice.
```

Nothing in this report authorizes staging, committing, pushing, releasing, resetting, cleaning or deleting files.

## Revised cleanup / S97 readiness gate

`S96_POST_COMMIT_CLEANUP.md` is the concrete plan; `tools/dev/s96-post-commit-archive-allowlist.txt` records **71 exact temporary file paths** (26 visible untracked artifacts and 45 already ignored ZIP/log/Repomix/verifier artifacts). Neither manifest authorizes execution. Current reports/backups already under ignored `tools/reports/` remain there; no recursive relocation of that tree is planned.

After separate staging, commit and cleanup approvals, the archive must preserve content hashes and relative paths beneath a fresh ignored `tools/reports/S96-post-checkpoint-<actual-commit>-<timestamp>/` directory. Only then rerun regression/browser checks without migration payloads in their old locations and require `git status --porcelain=v1 --untracked-files=all` to be empty. A clean S97 baseline is a future acceptance gate, not the current status or a release claim.
