# newCAS Frozen-Architecture Implementation Roadmap

**Status:** S96 committed/archived/verified; S97a/b/c GREEN in the uncommitted worktree, awaiting architecture/regression review and checkpoint approval.
**Numbering:** Preserve P0001–P0050 landmarks; S97 slices are incremental evidence.
**Authority:** FROZEN v1.0 and accepted ADRs remain normative and unchanged. New ADR-0007 v1 is Proposed for review only.
**Git baseline:** `architecture-v1-implementation`, HEAD `88a0a9bd5dcd8e341501e7fd5251f31817c9d01a`.
**Latest acceptance:** Full Node v24.11.0 **1501 PASS / 0 FAIL / 7 TODO / 1 SKIP** (1509 tests); focused S95–S97 **447 PASS**, S97c.4 **30 PASS**; Python **264 PASS**; actual Chrome/Pyodide/SymPy **16 scenario PASS / 0 FAIL**. Exact parser source/AST sync and whitespace PASS. Inherited TODO/SKIP remain open release gates.
**Immediate priority:** S97c.4 has closed staged-review R1/R2; the 32-path index is unchanged, with corrections only in the worktree. Review [S97 closure](S97_CLOSURE.md), [consumer audit](S97_REVIEW.md) and proposed read-only-boundary ADR; approve the proposed 33-path re-staging scope, then exact staged-set/diff verification before separate commit approval. Selected formula history routing and runtime read-only encapsulation are GREEN. Text/multi-task routing, generic direct structural rollback, legacy UI and offline release work remain separate. Root Selenium artifacts are temporary and excluded, not deleted. No re-staging/commit/cleanup performed by S97c.4.

## Purpose and governing principles

This roadmap records **capability, ownership, evidence, and open work** after architecture freeze. It is not a strictly chronological implementation queue. Slices may be split or reordered when evidence demands it; a green slice does **not** close a P-phase unless its exit is demonstrated.

- **No architectural shortcuts:** Canonical source → Peggy AST → source roles/attestation → Semantic IR → Value/selected evaluator → Worker transport → controlled SymPy backend. Document resolution, mathematical semantics, backend execution, and presentation retain separate ownership.
- **No additional evaluator and no Python string-code generation in the selected path.** Legacy can be temporarily contained, but its `exec`/`eval`/codegen model must not migrate into the IR engine.
- **Frozen contracts outrank roadmap convenience.** Any change in frozen mathematical or document semantics requires an explicit version/ADR decision before implementation.
- **RED → GREEN with traceable evidence:** Small repo-relative ZIP slices, controlled PowerShell verifiers, full JS/Python gates, and real browser/Pyodide tests where applicable. A TODO is never silently counted as an implemented case.
- **Release hygiene:** Build student distributions by allowlist; never ship `tools/`, test reports, one-shot migration scripts, transport ZIPs, tests, repomix dumps, or developer-only dependencies.

## Implementation checkpoint — 20 October 2026

| Track | Demonstrated implementation / evidence | Remaining before exit |
| --- | --- | --- |
| **P0001–P0011: frozen contracts/adapter** | Originally closed and tested; frozen v1.0 remains unchanged. | Continue invariant regression at every integration boundary. |
| **P0012: scalar evaluator** | Selected arithmetic, trigonometric, numeric Value/Worker paths; S93a–b consolidated duplicated expression lowering/traversal. | Complete agreed OperationSpec coverage, diagnostics, and exit audit. |
| **P0013: FunctionValue** | Lexical binders, immutable captures, derived functions, and attested composed calls (S93c RED → S93d GREEN); prior real Pyodide smoke. | Full document/function-capability audit, higher-order/arity cases as required by scope. |
| **P0014: symbolic operations** | Selected `diff` via real-browser SymPy; S93f–h project symbolic occurrence identities and providers through IR into Value materialization. | Active attested Worker execution of `integrate`/`tangentline` and other selected operations, actual browser coverage, diagnostics and capability exit. **F7 remains partly open.** |
| **P0015–P0017: containers, quantities, statistics** | Original contract foundations and backend capability probes. | No full end-to-end exits demonstrated for the three evaluator tracks. |
| **P0018: grammar/parser** | Canonical Peggy source/generated-parser sync gates; S91a packrat cache protects selected pathological parses. | Complete language/i18n audit, Danish decimal comma vs. argument comma, exact numeric-literal precision, other grammar stress cases. |
| **P0019–P0020: semantic resolution/writers** | Source/provider attestation, positional binding, function scopes; S93e RED → S93f GREEN, S93g symbolic identity separation within one expression. | Complete normative audit and consistency across **active** evaluator routes. |
| **P0021–P0025: DocumentRuntime** | Earlier reactive/generation slices; S95d engine-free `DocumentRuntime.createSemantic()`; S95n atomic FormulaBlock transactions; S95p demonstrated epoch-safe Undo/Redo and binding recalculation in real Pyodide. | Normative end-to-end audit of **all** required document states, error/stale cases, task boundaries and the future active UI remains open. |
| **P0026–P0037: editor, presentation, persistence** | S95e explicit calculate; S95f dynamic test documents; S95g existing renderer projection; S95i–k EditingSession/Enter; S95l–p FormulaBlock structural edits, transactions, history and real-browser proofs. | **Temporary TEST UI only**; all-authoritative-edit integration, full P0026–P0028 contracts, actual student UX, graphs/tables, `.ncas` integration and export remain open. |
| **P0038–P0042: legacy retirement** | S80–S84 partial retirement; S92a limited containment; S95a active-route audit and S95h UI event/authority audit; semantic-only browser pilot works without legacy. | Prototype `main.js` still invokes legacy `CASEngine`/codegen; no active full cutover or verified deletion. **A successful TEST UI path is not retirement.** |
| **P0043–P0050: hardening/release** | S92b mandatory `npm test` gates; parser integrity checks; S89 student-release allowlist; S94a–f supervised transport, explicit recovery, P0009 diagnostics, revision fail-stop; real Worker and real Pyodide browser evidence. | Active UI/real Pyodide recovery cutover, payload/memory/CPU budgets, offline release, performance, normative browser matrix, student UX, and Release-1 audits. |

### Milestones since the former Slice-38 checkpoint

| Slices | Delivered boundary | Qualification |
| --- | --- | --- |
| **S39–S60** | Selected document source/runtime, binding/invalidation models, async generations, and stale-result protection expanded and exercised. | Selected routes/tests are not a complete normative browser/document exit. |
| **S80–S84** | Legacy-retirement and routing cleanup toward selected runtime. | Legacy user-facing execution remains. |
| **S85–S90a** | Independent RED/stress probes; F1/F2 incomplete-source handling closed; F4 legacy-injection surface partially contained; canonical parser generation, student allowlist, and pure positional multi-statement analysis. | No active semicolon evaluation; residual legacy-F4 risk. |
| **S91a** | Peggy packrat/memoization for nested parse cases. | Not a general CPU/memory/time-budget solution. |
| **S92a–b** | Restricted legacy builtin namespace; `npm test` now mandates JS+Python and preserves visible TODO status. | Legacy `exec`/`eval` remains; seven TODOs are not passes. |
| **S93a–b** | Shared arithmetic IR lowering and expression-tree walk across two compiler routes. | Routes retain separate lexical/attestation ownership; not one fully merged compiler. |
| **S93c–d** | RED→GREEN attested composed functions, positional immutable captures, and redefinition behavior. | Broader capability audit still pending. |
| **S93e–h** | RED→GREEN source-symbol occurrence roles; attested IR identity; shared IR→Value symbolic materialization. | Active symbolic Worker integration not enabled by this checkpoint. |
| **S94a–f** | Opt-in Worker deadline/max-pending/fatal supervision; real-browser probes; explicit owner restart; P0009 diagnosis bridge; revision-coupled selective DocumentRuntime retry; revision-reader fail-stop. | Verified in Node 24; S94b, S94c and S94e browser tests PASS. Still **not** active student UI recovery, a full resource/memory budget, or proof of student release readiness. |
| **S95a–d** | Read-only legacy/UI route audits, temporary selected-runtime browser pilot, draft-only test-file ingress and engine-free semantic DocumentRuntime construction. | Test-only route; legacy `main.js` unchanged, no `.ncas` format change. |
| **S95e–h** | Explicit calculate action; 1–32 FormulaBlock test-file UI; selected Value/P0009 rendering through existing `renderer.js`; prototype Enter/identity/authority audit. | Test infrastructure and presentation subset, not a production student editor. |
| **S95i–m** | Formula EditingSession, Enter submit, single insert/move/remove operations; real Pyodide browser proof for Enter and order-sensitive provider capture. | Stable block IDs and draft/authority separation demonstrated; no full editor or all-task editing coverage. |
| **S95n–p** | Prevalidated atomic FormulaBlock document transactions, session Undo/Redo history, real Pyodide history/epoch/browser proof. | Only transactional edits are recorded. Content-changing external mutation makes Undo fail closed; same-content ABA/recreation is not detected; histories are not `.ncas` payloads; text/graphs/settings/task-boundary completeness remains open. |
| **S96a.1–b.2** | Source rollback and guarded publication; atomic multi-draft Calculate; exact pending Enter through history; runtime-owned ephemeral source/incarnation identity; synchronous source acceptance releases history Enter before Worker settlement. | Non-history behavior and single-flight remain. Content-based history divergence still misses external ABA/recreation; mixed-route all-edit integration, complete normative coverage and offline release remain open. |

### Representative accepted scenarios (not full exits)

- **Earlier real Pyodide/browser:** With document `x:=12`, a function-local binder stays local and `f(12)=1776`; real SymPy/Worker returned `f'(0)=4`, `f'(1)=7`, and `f'(12)=436`.
- **S93d attested function composition (test evaluator):** Separate document blocks `f(x):=x+1`, `g(x):=2*f(x)`, `g(3)` produce 8; captures and subsequent redefinitions are covered.
- **S93f–h binding/Value contract:** For `x:=17` followed by `integrate(x^2,x,0,x)`, the integrand/target `x` is local while the upper-bound `x` references the document's provider 17. This does **not** demonstrate active symbolic integration in the Worker.
- **S93h acceptance (17 October):** 1,063 JS PASS, seven TODO, one SKIPPED, zero FAIL; 264 Python PASS; Git checkpoint `440fea3`. The frozen normative stress suite is not claimed closed.
- **S94f acceptance (18 October):** 1,125 JS PASS, seven TODO, one SKIPPED, zero FAIL; 264 Python PASS. Browser: S94b real supervised Worker plus real Pyodide/SymPy; S94c explicit Worker restart; S94e DocumentRuntime recovery — all reported PASS. S94f introduces no new browser bootstrap path.
- **S95p acceptance (19 October):** 1,309 JS PASS, seven TODO, one SKIPPED, zero FAIL; 264 Python PASS; focused 151/151, parser check PASS. Real browser S95f (test file), S95k (EditingSession/Enter), S95m (insert/move/remove), S95p (Undo/Redo, history branching) each reported PASS with genuine Pyodide/SymPy. Node full-suite results and browser observations are separate evidence.
- **S95p document-history browser example:** `a:=2; f(t):=t^2+a` in separate blocks gives 11/18; insertion of `a:=5` ahead of function gives 14/21; Undo gives 11/18, Redo 14/21; moving definition changes provider back to 11/18; further source edit `a:=8` yields 17/24; undo and a fresh `a:=6` changes result to 15/22 and truncates redo branch. Epoch always advances; historical Values/Worker state are not restored.

## Next execution plan — proposed sequencing, not a new normative contract

1. **S96 closure complete:** Actual commit `88a0a9b`; 71 exact files reversibly archived under ignored `tools/reports/S96-post-checkpoint-88a0a9b-20261020-205305-229/`. All hashes/sizes verified, original paths absent. Node/Python/real-browser/parser checks passed and Git was clean before S97. Historical S96 closure/staging documents describe their preparation-time state; actual evidence is in the archive and CODEX_HANDOVER_S97.md.
2. **S97a GREEN, approved public-API scope:** Runtime-owned opaque document mutation identity now guards history divergence and prepared-plan staleness while retaining content checking. Initial/extended RED became 62 S97 PASS; focused 168 PASS, full Node/Python and real browser green with the known TODO/SKIP. See [S97a GREEN and limits](../architecture/P0021-slice-97a-history-mutation-identity.md). No automatic history routing or raw-block encapsulation; no S97 commit yet. Review routing/ownership as the next separately scoped slice.
3. **UI design as new work:** do not optimize for historical `main.js` layout or legacy error rendering. Build the new student UX above EditingSession/DocumentRuntime and existing renderer, with humane P0009 diagnostic localization; graphs/PlotSpecs and guided teaching features must retain presentation-only ownership.
4. **Capability and normative gates:** disposition of all seven TODOs and the Windows symlink SKIP is recorded in [S96 closure](S96_CLOSURE.md); none counts as PASS. Close the applicable release blockers; expand selected OperationSpec/evaluator/Worker support, especially active symbolic routes, containers/units/statistics as required by Release 1; run applicable 53+ frozen stress cases against the actual document/Worker path, with real browser/recovery tests.
5. **Legacy retirement:** use S95a and S95h route inventories to remove, caller by caller, remaining `main.js` → legacy `CASEngine`/Transformer/Python `exec`/`eval` dependencies. The successful S95 temporary browser route is **not** proof that existing legacy is unreachable. No student release with an active legacy fallback.
6. **Persistence and external review:** preserve `.ncas` as a versioned authoritative-document format, extensible for future graph specifications without Python/Worker snapshots; verify save/reload and reconstruction. A narrow Claude review can inspect S95 transaction/epoch contracts after the checkpoint, while full retirement review is more valuable once legacy is removed or proven unreachable.

**Stop/replan rule:** If S94 or symbolic Worker integration requires changes to frozen Value, SemanticIdentity, IR, or document semantics, prepare a versioned decision/ADR before coding. A precise `UNSUPPORTED` response for a not-yet-shipped operation is preferable to a hidden parallel evaluator.

### Open risks and decisions at the S95 checkpoint

| Area | Current gap | Required evidence / decision |
| --- | --- | --- |
| **F5 — Worker lifecycle** | S94a–f provides opt-in timeout/terminal stop, explicit restart, P0009 diagnosis, caller-owned revision recovery and real-browser evidence. | Wire into the actual student UI, confirm real Pyodide timeout/recovery, guard payload size and resource budgets, and test versioned/offline deployment. |
| **F4 — legacy code execution** | Restricted builtins are only containment; dynamic Python and active legacy UI path remain. | Caller-by-caller cutover, deletion, and browser regression. |
| **F7 — symbolic binding during active evaluation** | S93g/h can compile/materialize scoped occurrences, but do not enable every symbolic Worker operation. | Selected OperationSpec/evaluator/Value/transport real end-to-end tests. |
| **F8 / P0018 — input accuracy/i18n** | Known Danish decimal-comma and literal-exactness probes. | Explicit source-language policy, canonical PEG tests, and Value roundtrips. |
| **Semicolon/multi-statement** | S90a positional analysis exists, but active sequential evaluation and atomic commit do not. | Versioned contract/ADR addendum: per-statement identities, ordering, failure, dependencies, rollback, invalidation. Do not retroactively reinterpret frozen ADR-0006 v1. |
| **Security/distribution** | Worker message/output validation, HTML injection, third-party/offline dependencies, and student artifacts lack one complete gate. | Adversarial tests and a fresh-machine student package audit without development files. |
| **Normative tests and TODOs** | S96 closure: all seven TODO are actual failing probes (S90 gate, two F7, three F8, one F4); one real-symlink SKIP is Windows EPERM. | Detailed classification in S96_CLOSURE.md; retain release gates for symbolic bindings, grammar/precision and legacy containment. S90 is deferred behind an ADR, not an authorized v1 feature. |
| **Editing / history completeness** | S96 connects history Enter and protects ACK identity/early release; non-history routes still exist. S97a detects public-API ABA/recreation with a separate document mutation token; raw-reference ABA remains outside scope. | Public-API divergence GREEN; next all-edit routing/ownership and raw-reference encapsulation review before editor-wide history acceptance. |
| **UI vs. `.ncas`** | The S95f browser page is developer-only; future student UI is expected to be redesigned substantially. `.ncas` has not been changed by S95. | Design human-readable localized diagnostics and usable student UI independently; version `.ncas` extensions for graph/table content with explicit persistence/migration tests. |

### Pedagogical/UI backlog — not a change to frozen mathematical semantics

- **Monotonicity line as guided scaffolding:** The UI could complete a monotonicity line only after the student has established the derivative, zeroes or other critical derivative points, breaks in the function's domain, derivative signs on relevant intervals, and pertinent function values. Validate those prerequisites **semantically**, not by matching commands or source strings. Future P0026–P0033/UX planning, not S94.
- **Book-like notation:** Make dot/cross products discoverable and display prime notation where appropriate without conflating presentation with internal OperationSpec/IR semantics.
- **Semicolon sequences:** Desired left-to-right behavior should match a sequence of separate blocks, but active multi-statement blocks are not authorized under frozen v1. See the ADR decision above.

### Capability-extension note: one-sided limits

A future `limit(expr, target, approach, direction)` should be governed by OperationSpec's existing value/symbolic/scoped argument semantics and valid direction metadata, and implemented through the established symbolic compiler, selected evaluator/Worker allowlist and SymPy Value adapter. Earlier backend capability probes/legacy implementations **do not** count as an integrated new-pipeline `limit`. Do not add a new document-level scope or change frozen Value/SemanticIdentity contracts merely to support `a+` / `a−`. Exact source spelling is a separate parser/UX decision.

## Phase A --- Freeze and capability gate

### P0001 --- Architecture freeze

**Status:** COMPLETE / GREEN

-   Final consistency pass across specification, stress tests and review
    resolution.
-   Remove contradictory legacy wording.
-   Mark normative documents `FROZEN`.
-   Record freeze date/version and superseded assumptions.

**Exit:** one unambiguous normative architecture baseline.

### P0002 --- Dependency/version inventory

**Status:** COMPLETE / GREEN

-   Inventory actual versions and browser/offline constraints.
-   Pyodide, SymPy, NumPy, Plotly.js, KaTeX, Peggy.js and actual runtime
    dependencies.

**Exit:** candidate compatible version set.

### P0003 --- Backend capability probes

**Status:** COMPLETE / GREEN

Probe only capabilities required by newCAS contracts:

- Symbols/Dummy identity and capture.
- Functions/substitution.
- Solve sets/ConditionSet.
- Limits/special values.
- Matrices and units.
- Numeric/statistical paths.
- Serialization-relevant objects.

**Exit:** documented capability matrix and known limitations.

### P0004 --- Version lock and developer baseline

**Status:** COMPLETE / GREEN

-   Lock selected dependency versions.
-   Confirm Python/Node/npm developer baseline.
-   Extend Doctor later to verify these contracts.

**Exit:** reproducible supported toolchain.

## Phase B --- Contracts before migration

### P0005 --- Value contract v1

**Status:** COMPLETE / GREEN

Define backend-independent immutable public Values:

- Scalar/expression, function and relation/set as required.
- List, vector, matrix and quantity.
- Structured rich results where Release 1 demonstrates a need.

**Exit:** Value fixtures and serialization tests.

### P0006 --- Semantic identity contract

**Status:** COMPLETE / GREEN

-   FreeSymbolIdentity.
-   Binder identity.
-   operation-local symbolic targets/dummies.
-   capture/shadowing rules.

**Exit:** identity/capture stress tests green without DocumentRuntime.

### P0007 --- Semantic IR v1

**Status:** COMPLETE / GREEN — 172/172 JS tests at original closure

Define the smallest resolved IR needed by the frozen semantics.

**Exit:** source-independent IR fixtures for normative cases. **MET.**

### P0008 --- OperationSpec v1

**Status:** COMPLETE / GREEN — 220/220 JS tests at original closure

Define declarative public-operation metadata:

- Argument roles and symbolic scopes.
- Evaluator dispatch and purity/volatility.
- Diagnostic adaptation hooks.

The v1 contract keeps operation policy declarative. In particular,
`scopeOver` describes which arguments are governed by an
operation-introduced scope; it does not allocate semantic identities or
perform resolution. P0019 must consume `role` / `scopeOver` generically
and record the resolved result using the P0006 identity and P0007
Semantic IR contracts. It must not introduce a second scope mechanism or
permanent operation-name special cases for operations such as `diff` or
`integrate`.

For integration, the integration variable is a symbolic target while
bounds are ordinary Values. Thus variable bounds such as
`integrate(f(x), x, 1, x)` require no integration-specific resolution
rule.

P0014 owns symbolic mathematical evaluation after resolution. P0009 owns
structured diagnostic codes; `diagnosticAdapterId` remains an opaque
declarative adaptation identity in OperationSpec.

**Exit:** representative operations described without DocumentRuntime
special cases. **MET.**

### P0009 --- Diagnostic contract v1

**Status:** COMPLETE / GREEN

Structured codes/parameters for parse, resolution, unsupported, arity,
type/dimension, backend and blocked states.

**Exit:** tests assert diagnostic codes rather than backend strings.

## Phase C --- Pure evaluator

### P0010 --- Evaluator transport boundary

**Status:** COMPLETE / GREEN — 308/308 JS tests at closure

Define:
`resolved instruction + input Values + options -> EvaluationOutcome`.

No taskId, document order, history cursor or dependency graph.

**Exit:** Canonical immutable request/outcome contracts,
deep transport validation, dense Value input arrays,
and structured success/failure outcomes. **MET.**

### P0011 --- SymPy Value adapter

**Status:** COMPLETE / GREEN — 29/29 Python; 29/29 Pyodide; 323/323 full JS regression

Translate Values/identities to and from SymPy without accidental
capture.

The completed initial adapter supports ExpressionValue integers, rationals,
approximations (including explicit `precisionBits`), symbol references and
arithmetic `add`/`mul`/`pow`. Equal display spellings cannot merge distinct
SemanticIdentities. Unknown backend-generated symbols are rejected rather
than silently assigned new public identities.

**Scope boundary:** This completion does not imply support for all P0005
Value families or for `constant` / `call` conversion. Function evaluation,
symbolic operations, containers, units and statistics are addressed by
P0013–P0017 as concrete operation paths require them.

**Evidence:** 29/29 Python adapter tests; the same 29/29 on Pyodide 314.0.7
(Python 3.14.2, SymPy 1.14.0); 323/323 complete JavaScript regression
(308 at P0010 closure plus 15 new numerical Value tests). The seven
numerical transport probes also passed.

**Exit:** Initial ExpressionValue bridge validated in desktop Python and
the locked browser backend. **MET.**

**Records:** `docs/architecture/P0011-exit-audit-FINAL.md` and
`docs/architecture/P0011-slice-4-numeric-transport-decision.md`.

### P0012 --- Core scalar/expression operations

**Status (2026-10-18): PARTIAL / selected scalar-family Worker paths GREEN; S93a–b consolidated compilation; exit audit pending.**

Arithmetic, simplification where officially supported, exact/approximate
behavior.

**Exit:** Defined by supported scalar operations and their evaluator contract
tests, without document authority or persistent Python task scope.

### P0013 --- FunctionValue evaluation

**Status (2026-10-18): PARTIAL / lexical FunctionValue, immutable captures, real Worker smoke and S93d attested function composition GREEN; full document/capability exit pending.**

Immutable resolved closures, application, higher-order Values,
wrong-arity diagnostics.

### P0014 --- Symbolic operations

**Status (2026-10-18): PARTIAL / selected `diff` via real SymPy GREEN; S93f–h symbolic occurrence binding and IR→Value materialization GREEN; active integration and other Worker operations plus exit audit pending.**

diff/integral/sum/solve/limit according to OperationSpec symbolic-target
rules.

### P0015 --- Containers and linear algebra

**Status (2026-10-18): NOT AUDITED COMPLETE; initial contracts/probes are not a verified full container/linear-algebra path.**

List/Vector/Matrix semantics and backend error adaptation.

### P0016 --- Quantity/unit evaluator path

**Status (2026-10-18): NOT AUDITED COMPLETE; unit/Quantity evaluator path remains on the roadmap.**

Compose Quantity with ordinary Values; backend capability limited to
officially supported unit behavior.

### P0017 --- Statistics/regression/distributions

**Status (2026-10-18): NOT AUDITED COMPLETE; statistics/regression/distributions remain on the roadmap.**

Use natural backend (often NumPy/SymPy) behind stable public Values.

**Exit Phase C:** evaluator passes its contract tests with no persistent
task scope. **NOT YET MET AS A FULL-PHASE EXIT:** selected paths have passed, but P0015–P0017 and broader P0014 coverage remain.

## Phase D --- Semantic document runtime

### P0018 --- Parser/grammar alignment

**Status (2026-10-18): PARTIAL / canonical PEG generator and generated parser sync; S91a packrat GREEN; language/i18n RED probes, including Danish decimal comma, remain open.**

Adjust PEG grammar only where frozen semantics require it.

### P0019 --- AST → Semantic Resolution

**Status (2026-10-18): PARTIAL / lexical resolution, selected symbolic argument roles and S93f–g occurrence identities GREEN; full normative audit pending.**

Resolve lexical binders, symbolic targets, nearest predecessor and free
symbols.

### P0020 --- Writer/binding analysis

**Status (2026-10-18): PARTIAL / writer/source binding, provider attestation, positional projection and S93f role-aware binding GREEN; full document-source coverage pending.**

Implement exact parse/structural writer boundary and no
success-dependent fallback.

### P0021 --- Dependency model v2

**Status (2026-10-19): PARTIAL / selected document DAG, binding, task batches, stale gates, S95d engine-free semantic creation, S95n atomic FormulaBlock transactions and S95p real Pyodide history proof GREEN; full normative active DocumentRuntime/Worker exit unverified.**

Generate bindings + DAG from the same semantic analysis.

### P0022 --- Calculation state v2

**Status (2026-10-18): NOT CLOSED / selected outcome envelopes and document projections exist; complete UI/calculation-state audit pending.**

idle/running/success/error/dirty/blocked as derived runtime state.

### P0023 --- Reactive invalidation

**Status (2026-10-18): PARTIAL / selected reactive downstream invalidation and redefinition tests GREEN; full normative end-to-end audit pending.**

Provider changes, structural mutations, downstream invalidation.

### P0024 --- Evaluation orchestration

**Status (2026-10-18): PARTIAL / selected DocumentRuntime batches, attested evaluator dispatch and Worker path exist; active UI cutover and normative stress audit pending.**

DocumentRuntime sends resolved instructions/Values to evaluator in
correct dependency/order semantics.

### P0025 --- Async epoch/generation protection

**Status (2026-10-19): PARTIAL / generation/epoch protections, S94 Worker timeout/recovery and S95p late-result-after-Undo rejection demonstrated; full browser stale-result and hardening matrix pending.**

Pure, volatile and external results use identical stale-result
protection.

**Exit Phase D:** the 53+ normative architecture stress tests run
through DocumentRuntime. **NOT YET MET:** isolated/batch/Worker tests are not equivalent to this exit.

## Phase E --- Editing and presentation

**Checkpoint 2026-10-19:** S95e–p implements a **selected, test-only FormulaBlock editing/presentation path**; real student-UI design, complete P0026–P0033 exit and all-content Undo/Redo are **not** accepted. `main.js` is a disposable legacy prototype, not a design constraint. Guided monotonicity belongs to pedagogical UI planning, not frozen Value/IR contracts.


### P0026 --- EditingSession commit boundary

**Status (2026-10-20): PARTIAL / selected history Enter GREEN.** S96b.1/b.2 records exact pending Enter through HistorySession, checks runtime-owned source/incarnation identity and releases accepted drafts before asynchronous Worker settlement. Non-history Enter retains its previous lifecycle. Real S96b.2 browser proof passed; no complete multi-editor/student UI exit.

Editor buffers are separate from authoritative source.

### P0027 --- Document transactions / Undo/Redo

**S96 update (2026-10-20):** Source/transaction publication is guarded; multi-source Calculate is atomic in the semantic route; history Enter creates one Undo entry and revision. Content-only divergence misses external ABA/recreation; next slice must review this before editor-wide mixed-route release acceptance.

**Status (2026-10-19): PARTIAL, selected FormulaBlock path GREEN.** S95n prevalidates and atomically publishes source/insert/remove/move; S95o stores reversible session history; S95p real-Pyodide Undo/Redo/epoch/redo-branch proof PASS. Content-changing external mutations fail closed; same-content ABA/recreation remains undetected. Not all document content/entrypoints supported.

Reversible authoritative changes; no runtime snapshots.

### P0028 --- Structural editing

**Status (2026-10-19): PARTIAL.** S95l/m and S95n/p prove insert/remove/move for FormulaBlocks, stable opaque IDs and order-dependent bindings in real Pyodide. Copy/duplicate, cross-task semantics and complete transaction/UI workflows are open.

Insert/remove/move/copy/duplicate, including task-boundary semantics.

### P0029 --- Position-dependent visible Values

Derived `getVisibleValues(task, position)`-style projection for UI
tools.

### P0030 --- Text VAR segments

VAR picker, positional resolution, exact/decimal/significant-figure
presentation.

### P0031 --- Formula/result presentation

**Status (2026-10-19): PARTIAL.** S95g reuses existing `renderer.js` for supported Value forms and structured P0009 codes in the test UI. Neither complete Value coverage nor student-facing localization/layout is accepted.

Stable renderer consumes Value/diagnostic contracts, not backend
objects.

### P0032 --- Plot presentation

PlotSpec/data derived from Values; Plotly remains presentation only.

### P0033 --- Table semantics v1

Only after concrete Release-1 table requirements are fixed; preserve
state/presentation ownership rule.

## Phase F --- Persistence and reproducibility

**Checkpoint 2026-10-19:** P0034–P0037 remain open; **S95 did not change `.ncas`**. Preserve authoritative document/versioned persistence and plan explicit extensibility for future graph/table specification, without serializing Worker/derived history state.


### P0034 --- `.ncas` format v1

Authoritative document only plus version metadata and permitted
non-authoritative caches if useful.

### P0035 --- Save/load reconstruction

Fresh runtime rebuild from document order; no serialized Python scope.

### P0036 --- Migration/version handling

fileFormatVersion, languageVersion, engineVersion and migration policy.

### P0037 --- PDF/export path

Frozen presentation export for school submission.

## Phase G --- Remove legacy execution model

**Checkpoint 2026-10-19:** PARTIAL. S95a/h inventories active legacy/event boundaries; S95b–p proves a separate semantic test-UI route. `main.js`/`CASEngine`/Python codegen and `exec`/`eval` are **not** verified as removed. Do not confuse test-route success with retirement or production UI cutover.


### P0038 --- Compatibility bridge audit

Identify remaining callers of `run_in_task`, `task_registry`,
`ScopedGlobals`, reset/replay and old CASEngine semantics.

### P0039 --- Cut DocumentRuntime to new evaluator

No authoritative dependency on persistent Python task scope.

### P0040 --- Remove legacy Task Scope semantics

Delete/deprecate old state ownership only after new path is fully green.

### P0041 --- Remove obsolete replay/reset architecture

Keep reset only if useful as disposable cache maintenance, not semantic
repair.

### P0042 --- Simplify Python package/tests

Reorganize around evaluator/value/operation/backend contracts rather
than historical executor layout.

## Phase H --- Product hardening

**Checkpoint 2026-10-18:** PARTIAL. S89 release allowlist, S91 parser cache and S92 mandatory JS/Python gates exist. F5 Worker lifecycle/budgeting is prioritized for S94. Product release remains blocked by the legacy UI route and missing normative browser audit.


### P0043 --- Full regression matrix

**Status (2026-10-19): PARTIAL.** `npm test` requires JS and Python; S95p on Node 24 reported **1,309 JS PASS, zero FAIL, seven TODO, one skip; 264 Python PASS**. Real Pyodide browser proofs S95f/k/m/p exist, but normative stress cases still need traceable end-to-end coverage and TODO-by-TODO decisions.

Python + JS + end-to-end + normative architecture cases.

### P0044 --- Performance baseline

**Status (2026-10-18): NOT CLOSED.** S91a improved parser behavior with
packrat caching but does not establish CPU, memory, or Worker budgets.

Representative 100--500 block documents; dirty recalculation; large
symbolic/numeric cases.

### P0045 --- Worker/off-main-thread evaluation

**Status (2026-10-19): PARTIAL / selected Pyodide Web Worker and Value transport, S94 supervision/recovery and S95f/k/m/p real browser path demonstrated.**

Worker transport does not own document-semantic authority. S94 must
strengthen supervision (timeout, actual terminate/restart, message validation,
input/output budgets and stale cancellation); document generations still
decide whether late results may commit. Full active-browser and offline
release gates remain open.

### P0046 --- Offline packaging

**Status (2026-10-19): PARTIAL / S89 student allowlist exists; the S95 browser UI and helper files are developer tests and must not enter the student package. Full offline/fresh-install audits remain open.**

Pyodide/packages/assets/service-worker path tested without network.

### P0047 --- Doctor v2

Verify versions, generated artifacts, capability probes,
architecture-contract test suites and report freshness.

### P0048 --- Release-1 mathematical capability audit

Everything exposed in UI must be officially supported and semantically
complete.

### P0049 --- Release-1 UX/student-practice audit

Warnings, examples and UI encourage simple recommended patterns without
weakening language semantics.

### P0050 --- Release candidate

Fresh-machine test, save/share/reload test, PDF submission workflow,
failure recovery and documentation audit.

## Beyond P0050

Numbers after P0050 are deliberately unallocated. Likely future work may
include broader 2.g/3.g mathematics, richer tables, recursive-sequence
support if required, additional distributions, advanced plotting and
performance work.

Those features should receive numbers only when their requirements are
concrete.

## Milestones

-   **M1 --- Frozen architecture:** P0001
-   **M2 --- Known backend/toolchain:** P0004
-   **M3 --- Stable semantic/evaluator contracts:** P0009
-   **M4 --- Pure evaluator works:** P0017 (selected evaluator paths GREEN; P0015–P0017 and full capability exit remain open)
-   **M5 --- Reactive document runtime works:** P0025 (selected reactive/batch/generation paths GREEN; active normative DocumentRuntime/browser exit not yet met)
-   **M6 --- Student editing/presentation works:** P0033
-   **M7 --- Save/load/export works:** P0037
-   **M8 --- Legacy Task Scope gone:** P0042 (**OPEN** — S80–S84 delivered partial retirement; S93 did not close this milestone)
-   **M9 --- Release candidate:** P0050 (**BLOCKED** by active UI cutover, normative browser tests, offline/hardening, and legacy retirement)

## Governing rule

> Do not optimize the roadmap for preserving old code. Optimize it for
> reaching the frozen architecture through small, testable, green steps.

The old P07 work remains valuable prototype evidence and regression
knowledge. It is not the numbering authority for the new implementation
series.

