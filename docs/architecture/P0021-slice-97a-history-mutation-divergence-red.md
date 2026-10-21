# P0021 S97a - HistorySession mutation divergence / RED review

**Status:** Historical pre-approval RED analysis; scope was subsequently approved and GREEN is implemented.
See [S97a GREEN](P0021-slice-97a-history-mutation-identity.md) for current implementation, acceptance and limits.
The analysis/results below preserve the pre-approval state; statements about absent production changes
or a pending decision describe that historical checkpoint, not the current worktree.
**Baseline:** `architecture-v1-implementation` at `88a0a9bd5dcd8e341501e7fd5251f31817c9d01a`.
**Authority:** non-normative analysis and contract proposal. FROZEN v1.0 / accepted ADRs remain unchanged.
No production source, evaluator, scheduler, Worker, parser or existing regression was changed.

## S96 closure completed before S97 began

The separately approved 71-file archive operation completed at
`tools/reports/S96-post-checkpoint-88a0a9b-20261020-205305-229/`.
`inventory.json` records checkpoint, original relative paths, sizes and SHA-256;
`verification.json` records all 71 successful integrity checks and absent original paths.
No overwrite, permanent deletion, reset, clean, old cleanup script, push or additional commit was used.
OneDrive cloud reparse tags were verified (not symlink/junction targets).

Gate 4 ran with old artifact paths absent:
- Node v24.11.0: **1345 PASS, 0 FAIL, 7 TODO, 1 SKIP**, 1353 total.
- Full Python discovery: **264 PASS, 0 FAIL, 0 SKIP**.
- Real Chrome 155.0.8059.84 / supervised Pyodide/SymPy: **3 PASS, 0 FAIL/TODO/SKIP**.
- Exact canonical Peggy packrat output and regenerated-parser AST equivalence: **PASS**, not skipped.
- `git diff --check`: **PASS**.
- `git status --porcelain=v1 --untracked-files=all`: **empty before S97**.

Evidence is in the ignored archive: `final-node.tap`, `final-python.txt`,
`final-browser.json.txt`, `gate4-summary.json`.
The seven TODO remain the classified S90 extension gate, two F7 bindings,
three F8 grammar/precision and one F4 unit/legacy-boundary gap.
The single SKIP remains Windows real-symlink EPERM; portable guards pass.
These are unchanged release gaps, not silently accepted implementations.
Network-backed browser acceptance does not establish offline cold-start.

## Normative basis and contract limits

- Frozen specification sections 4 and 19: authoritative document, draft-only editing,
  reversible source/order transactions, linear history and redo truncation.
- Section 18.1, review resolution 2.13 and normative stress tests 31/32/52:
  host/runtime epochs advance monotonically; abandoned async results never publish after Undo.
- Review resolution 2.11 and stress test 50: typing remains draft state.
- ADR-0004: DocumentRuntime owns document relationships; presentation has no Python-scope authority.
- ADR-0005: history/runtime tokens are ephemeral, not submitted snapshot state.
- ADR-0006: authoritative block order and task bindings; full structural analysis;
  prevalidation and atomic rejected inputs. FormulaBlock v1 is not sequential multi-statement evaluation.
- S95n/o notes describe existing APIs, not a higher normative authority. Their documented
  fail-closed divergence intent is stronger than today's content-fingerprint implementation.

Frozen documents do not specify a concrete mutation-stamp API, the exact same-source setter
policy, arbitrary writable-reference protection, or whether all editor routes must be cut over
in this slice. Those scope choices must be explicit; no normative rewrite is proposed.

## Complete mutation-path inventory for the current selected document API

| Path | Actual authority / relationship to HistorySession | Stamp / routing implication |
| --- | --- | --- |
| Constructor / `DocumentRuntime.createSemantic` | Creates an empty authority. Blocks are subsequently added. History usually attaches after initialization. | Runtime-instance stamp may initialize once; no persisted global clock or ID allocator. |
| `addBlock` (document-runtime.js:202) | Writes blocks, rebuilds dependencies, then notifies formula task. Supports text too. Existing browser fixtures initialize this way. No history/revision owner in method. | Must be covered even when no formula notification is emitted. |
| `setBlockSource` (:341) | Mutates the live formula object, generation, dependencies and invalidation; refreshes source token. Has S96 rollback/publication guard. | Document stamp must detect ABA independently of live object and final text. An explicit same-text call currently still increments generation/source identity; do not silently make it a no-op. |
| `moveBlock` (:673), `removeBlock` (:708), `insertBlock` (:731) | Write authoritative order/existence, rebuild and invalidate. Move preserves persistent ID/object/source identity; insert clones the supplied block. Current direct structural methods are not staged atomic transactions. | Effective movement/existence changes need document-level identity; per-source tokens alone miss move-back or transient insert/remove. Same-index move is already a real no-op. |
| `prepareBlock`, `prepareDocumentTransaction` (:760) | Validation/staging only; no authoritative publication. Plan base captures refs/source/type/task/generation. | Preparation and invalid proposals must not advance document mutation identity. |
| `applyDocumentTransaction` (:837) | S95n sole atomic compound publication. Source replacements/insertions have fresh block objects; moves retain refs. Observer failures isolated, nested public mutations blocked. | Guard prepared base with document mutation identity; change stamp once for `kind:applied`, preserve it for `unchanged` and complete rollback. Current `plan.changed` also treats nonempty net-zero source/move/insert-remove sequences as applied. |
| HistorySession `execute/undo/redo` | Calls prepare, host revision advance, apply; owns inverse/forward operations and cursor. Content fingerprint is ID/type/task/source, not chronology. | Check current stamp + existing fingerprint before each action; update expected stamp only after owned publication. Keep content before/after verification for history targets; never compare Undo against an ancient stamp or restore an old stamp. |
| Calculate with `commitOperations` | Existing S96 route injects HistorySession. Exact pending Enter is recorded then ACKed; source acceptance precedes Worker settlement. | Keep the injection and sole host-revision ownership. No extra publication and no double epoch advance. |
| Calculate without history | One changed source uses direct setter; multiple semantic sources use S95n transaction; explicit legacy route stays sequential. Host revision belongs to Calculate. | Must invalidate an attached history on foreign edits; silently auto-recording these calls would expand the routing contract. |
| `createFormulaStructuralAction.apply` | Existing one-operation insert/remove/move route; owns host revision and preflight. Has no HistorySession injection. | Stamp detects foreign chronology; routing this through history is a separate integration change. Its own revision-callback preflight also merits a later stamp guard. |
| EditingSession `begin/replaceSource/prepareCommit/finishCommit/retryDraft/cancel` | Only draft/ACK state, except proposal is sent to existing action. | No document-stamp writes here; retain S96 source identity and draft safety. |
| Browser pilot S95b | Initializes using addBlock, Calculate without history. File load changes DOM drafts only. | Already public-API writes, not a new model. |
| Browser S95f/k/m | Initializes with addBlock; explicit run reconciles via direct remove/insert/move then non-history Calculate; Enter without history; structural action direct. `p0021-slice-95f-draft-structure.mjs:34-40`. | Important mixed-route callers. Not accepted as editor-wide history. Permanent RED includes the actual reconciliation helper. |
| Browser S95p acceptance | Creates a local history only inside its acceptance callback, records transactions; re-evaluates via normal run with unchanged source/structure. | Must continue working: evaluation-only operations must not diverge history. |
| Browser S96b.2 | Initializes before history, injects history into Calculate, tests actual Worker/Undo. | Already the selected history-integrated route; preserve its 3 real browser scenarios. |
| Older S82/S83/async/recovery smoke modules | Add source fixtures; selected smokes call direct setters. No shared history instance. | Public operations still covered; no migration to legacy evaluation. |
| Existing `main.js` | Uses CASEngine/Transformer and DOM cells, not DocumentRuntime/HistorySession. | Legacy cutover remains a separate roadmap gate. This slice must not add a fallback or claim active UI retirement. |
| Calculation methods, dirty/invalidation, supervised run/restart/close | Derived calculation slots/caches and host revision; no authoritative source/order write. | No document-stamp change solely for result publication, dirtying, Worker restart or host epoch. Runtime/transport stale guards remain active. |
| `blocks`, `getBlock()`, `getBlocks()` | Public blocks array/live object permit raw writes to source, ID, task and order; getBlocks copies top-level blocks (calculation objects remain shared derived state). No such authoritative raw write found outside DocumentRuntime in current src/browser callers. | A public-method stamp cannot intercept raw source ABA or array reorder/back. Keep content guard for visible raw divergence; full raw-ABA protection requires a separate ownership/encapsulation decision. |

Search scope: src/js and all current tests/browser callers, including preparation/apply,
direct source/order writes and constructors. Test fixtures also inject derived states;
these do not make a second production document authority. No persistent .ncas load/mutation
route is implemented in these selected modules; test-file draft ingress is not one.

Direct structural primitives can currently throw after a partial authoritative change
under injected rebuild/invalidation failure. A future stamp must detect any escaped
mutation; it cannot equate 'method threw' with 'authority never changed'.
Adding full structural rollback would be a separate patch/scope review, not hidden in stamp plumbing.

## Permanent RED tests and actual results

`tests/js/p0021-slice-97a-history-mutation-divergence-red.test.mjs` has **42 tests**:

- **27 failing probes**: Undo, Redo and Execute each reject nine histories with identical final content:
  direct source ABA; remove/add; remove/insert; move/back; add/remove; insert/remove;
  compound source ABA; compound move/back; compound insert/remove.
- **4 failing mixed-owner probes**: competing HistorySession, real non-history Calculate,
  structural action, and S95f reconciliation helper.
- **2 failing plan-race probes**: prepared plan after structural ABA and structural ABA
  inside the host revision callback.
- **9 passing controls**: prepare/rejection; unchanged/redo; direct and transactional rollback (2);
  calculation-only/host-only changes; linear Undo/Redo/source identity; reentrant observer;
  exact draft ACK; actual semantic stale-result rejection after edit/Undo.

Actual isolated result: **9 PASS, 33 FAIL, 0 TODO, 0 SKIP, 0 cancelled**.
Every failure is `Missing expected exception`, not an import/harness/backend failure.
Logs: `s97a-red.tap` in the ignored S96 archive.

Full Node with RED installed: **1354 PASS, 33 FAIL, 7 TODO, 1 SKIP**, 1395 total,
0 cancelled, exit 1. All 33 unmarked failures are the new expected RED probes;
the previously accepted 1345 passes and known TODO/SKIP remain.
No Python/browser rerun was necessary after adding only tests/docs; their Gate 4 runs above
preceded S97 creation. Do not describe this current worktree as all-GREEN or Git-clean.

A separate in-memory characterization confirmed raw `getBlock().source` ABA leaves
source identity and generation unchanged and history Undo still applies. This is reported
as an exposure boundary, not enshrined as an approved passing safety test.

## Alternatives

| Option | Strength | Risk / scope |
| --- | --- | --- |
| A. Runtime-owned opaque mutation stamp, retain content guard | Smallest chronology guard for all supported public edits and stale prepared plans; no document mirror; works with competing histories and current optional history routes. | Must specify same-source calls, applied net-zero compounds, failure/publication boundaries and raw-reference exclusion. Does not auto-record foreign edits; fails closed. |
| B. Enforce all editing through one history-aware route first | One Undo owner for user actions; future UI can record all commands intentionally. | Broader UI/host/API ownership work; needs all Calculate/structure/reconcile callers and multiple-session policy. UI routing alone cannot prevent direct runtime access or raw writes. Public API restriction would change compatibility. |
| C. A first, then scoped routing / encapsulation | Immediate detectable-public-edit safety followed by explicit integration, without changing mathematical semantics. | Must not present the first slice as protection against arbitrary raw writes or complete student editor history. |

**Recommendation: C, delivered as A in S97a GREEN after approval.** Route consolidation and
mutable-reference encapsulation follow as separately reviewed slices. No new evaluator,
scheduler, transaction model, implicit replay or persistence data.

## Proposed minimal GREEN patch (not implemented)

1. DocumentRuntime owns an ephemeral opaque document mutation token and a read-only reader.
   It is distinct from source/incarnation identity, host revision and calculation generation.
   Seed at construction; regenerate for effective public source/order/existence publication.
2. Cover all six public write routes, including text add/remove and all tasks. Do not
   infer edits from semantic notifications: these omit some non-formula changes.
   Preserve no-op move and `kind:unchanged`; preparation and fully rolled-back source/
   transaction failures leave the accepted token unchanged.
3. Capture token in prepared plan base and reject mismatches before applying any staged
   authority. This closes move/back inside advanceRevision without overloading generation.
4. HistorySession stores only expected token + its existing content fingerprint;
   guard all actions before any history epoch advance, update after owned commit/Undo/Redo.
   History entries keep reversible content operations, not old runtime tokens.
   A competing history's public edit must invalidate the earlier owner's continuation.
5. Preserve source-token behavior, calculation slots, host epoch, exact pending ACK and
   callback-failure semantics. No automatic history reset, merge, source rollback, retry,
   Worker restart or replay on divergence.
6. Keep raw content divergence checks; do not silently freeze/proxy blocks or change
   getBlock identity compatibility in this slice. Direct primitive failure boundaries
   must expose any actual escaped change to the token rather than hide it.

Expected production paths: `src/js/document-runtime.js` and
`src/js/editing/create-document-history-session.js`; no other runtime module unless
tests identify a necessary boundary. Before implementation, review fault-injection
and same-source/text/task cases and add RED tests for the agreed token API.
Rollback scope would be only the new S97 production hunks; the S96 commit stays intact.

## Acceptance matrix for the proposed GREEN scope

| Scenario | Required result / evidence |
| --- | --- |
| Public source ABA / same-ID recreation | Execute/Undo/Redo reject before another history revision; content and cursor unchanged. |
| Public move/back / transient insert/remove / other-task or text edits | Document-wide divergence detected, even with original final content. Add text/task API-token probes before GREEN. |
| Applied compound net-zero sequence | Counts as a public publication under current plan.changed contract; foreign history must diverge. No implicit compound normalization. |
| Same-text direct setBlockSource | Preserve current effective write/generation/source-token contract; proposed document token changes too. No-op Calculate/unchanged transaction still preserve token. |
| Prepared plan / host callback structural ABA | Stale plan rejected, no partial planned edit/history entry; already consumed host epoch remains monotonic. |
| Preparation, invalid proposal, fully rolled-back source/transaction | No accepted token change and no foreign history divergence. |
| Direct structural method throws after escaped change | Token must reflect escaped authority, or method must gain explicit rollback under a separately reviewed patch. No false 'unchanged' claim. |
| Undo/Redo and branch | Fresh document/source identities as applicable; monotonic host epoch; cursor/redo semantics unchanged. |
| Dirtying, result publication, host-only epoch/restart | No document mutation-token change; history remains usable; Worker safety guards unchanged. |
| ACK/callback/active-draft/unchanged Enter | All S95/S96 regressions and 3 S96b.2 real-browser scenarios remain green. |
| Delayed actual Worker after edit/Undo/foreign edit | No stale Value/error publication; new draft never touched; add real-browser mixed-route proof. |
| Raw exposed source/array ABA | Outside proposed S97a guarantee until explicit encapsulation/routing decision; existing non-ABA content guard retained. |
| Final regression | Targeted S97 + S95/S96, full Node 24/Python, canonical parser sync, relevant actual Pyodide browser matrix; report exact FAIL/TODO/SKIP. |

## Decision required before GREEN

Approve or revise this proposed scope:
1. S97a detects **public-API mutation chronology**, fails closed on foreign edits and
   strengthens prepared-plan staleness. It does not yet prevent arbitrary raw writes
   through mutable blocks or automatically route/record all editing.
2. Preserve the current effective-write classification: direct same-text setter and
   applied nonempty net-zero compound transactions count as publications; unchanged
   transactions/same-index moves and derived-only changes do not.
3. Broader all-edit routing, mutable-reference encapsulation and any structural rollback
   redesign require a separate reviewed slice.

No GREEN implementation, staging, commit or push has been performed in S97.
