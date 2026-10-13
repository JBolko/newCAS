# newCAS Frozen-Architecture Implementation Roadmap

**Status:** Living implementation roadmap (sequencing may change).  
**Numbering:** Implementation series `P0001` onward.  
**Rule:** Frozen architecture is normative; roadmap sequencing is not.  
**Progress (2026-10-13):** P0001–P0011 complete as originally audited. Subsequent implementation deliberately crossed roadmap phases; P0021 Slices 14–38 established selected scalar, symbolic, FunctionValue and Worker paths. **713/713 JavaScript tests and the Slice 38 real-browser regression were reported green by the developer.** This is an evidence snapshot, not a claim that P0012–P0025 have met all their exits.
**Git baseline:** `6a6ee24` (`architecture-v1-implementation`) covers work through Slice 35; Slices 36–38 are locally validated but require the next commit.
**Current priority:** Integrate the established semantics/evaluator boundary into the real DocumentRuntime, then verify document edits, dependency binding, invalidation, ordering and stale-result protection.
**Test totals are snapshots, not exit conditions.**

## Purpose

This roadmap provides stable landmarks after architecture freeze without
pretending that implementation can be predicted in full detail.

A phase may be split, merged or reordered when implementation evidence
requires it. A roadmap change does not change architecture. Any
implementation discovery that would change frozen mathematical semantics
requires an explicit architecture decision/ADR before coding proceeds.

## Implementation checkpoint — 13 October 2026

The originally numbered phases remain useful **capability and ownership landmarks**, not a strictly chronological queue. Slices are experimental/incremental implementation steps, **not** replacement roadmap project identifiers. A green slice does not close a roadmap phase without its stated exit criteria.

| Track | Verified / implemented so far | Remaining before exit |
| --- | --- | --- |
| Contracts P0001–P0011 | Originally closed / green; frozen architecture remains authoritative. | Preserve invariants as integration broadens. |
| Scalar evaluator P0012 | Selected `add`, `multiply`, `power`, signed-source and trigonometric/scalar-family paths; real Pyodide Worker smoke checks. | Full agreed capability/diagnostic coverage and exit audit. |
| FunctionValue P0013 | Definition compilation, lexical binders, immutable materialization, application, provider-selected evaluation, capture and shadowing checks; real Worker checks. | Full document integration, multi-argument/higher-order/arity cases as required by scope. |
| Symbolic P0014 | `diff` through selected symbolic request → SymPy → immutable result; differentiated FunctionValue and invocation verified in real browser (`f'(12)=436`). | Broader selected symbolic capabilities (`integrate`, `sum`, `solve`, `limit`), robust diagnostics and exit audit. |
| P0015–P0017 | Earlier capability probes/contract foundations may exist. | Containers, units, statistics/regression end-to-end paths are not yet evidenced as complete. |
| Parser/resolution P0018–P0020 | Selected source AST and signed precedence, symbolic argument roles, lexical function definitions and source/provider binding slices. | Full grammar/resolver coverage and normative boundary audit; P0018 i18n/grammar RED probe outstanding. |
| Document P0021–P0025 | Selected binding/DAG/batch/worker plumbing, revision-guarded provider outcomes and fail-closed checks demonstrated. | **Next:** actual DocumentRuntime end-to-end orchestration, source edit/rebinding, dirty propagation, task boundaries, generation/stale protection and normative stress suite. |
| UI/persistence/legacy removal/hardening P0026–P0050 | Planned landmarks retained. | Not claimed complete on the basis of evaluator smoke tests. |

### Verified integration examples (not full document-runtime exits)

- Browser: local parameter vs. document `x:=12`; `f(t):=t^3+4t`; `f(12)=1776`; repeat application and provider mismatch rejected.
- Browser: actual SymPy derivative retains lexical binder; derived immutable `FunctionValue` evaluates at 0, 1 and 12 to **4, 7, 436**.
- Slice 37 exposed JSON transport losing `Object.freeze`; Slice 38 moved decoding/validation into the shared Worker client boundary. The resulting browser path passed without caller-local repair.
- Node full suite: **713 green** as reported by the developer after Slice 38; this is a timestamped verification point, **not** an exit condition.

### Immediate next execution order

1. **Checkpoint commit:** Stage only Slice 36–38 production changes, tests and architecture notes; check staged diff and run `git diff --cached --check`. Exclude transport ZIPs and the separate P0018 RED probe.
2. **DocumentRuntime integration, first vertical slice:** real document sources `x:=12`, `f(t):=t^3+4t`, then selected application `f(x)` → 1776 with nearest-predecessor provider identity, ordered Value evaluation and no Python scope. Keep the first slice small and testable.
3. **Reactive behavior:** changing `x` or `f` invalidates only downstream dependents; revisions prevent stale asynchronous commits; wrong/unavailable providers fail closed.
4. **Derived-function document path:** incorporate derived `FunctionValue` into document orchestration, then test the equivalent of `g(t):=diff(f(t),t)` and `g(x)=436`. Resolve precise language syntax/semantics against the frozen contracts rather than assuming this illustrative syntax is already supported.
5. **Normative end-to-end audit:** exercise the 53+ architecture stress tests through actual DocumentRuntime before closing P0021–P0025. Then resume missing Phase C operations and grammar gaps in priority order.

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

**Status:** COMPLETE / GREEN — 172/172 JS tests at closure

Define the smallest resolved IR needed by the frozen semantics.

**Exit:** source-independent IR fixtures for normative cases. **MET.**

### P0008 --- OperationSpec v1

**Status:** COMPLETE / GREEN — 220/220 JS tests at closure

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

**Status (2026-10-13): PARTIAL / selected scalar-family Worker paths GREEN; exit audit pending.**

Arithmetic, simplification where officially supported, exact/approximate
behavior.

**Exit:** Defined by supported scalar operations and their evaluator contract
tests, without document authority or persistent Python task scope.

### P0013 --- FunctionValue evaluation

**Status (2026-10-13): PARTIAL / lexical FunctionValue, capture/application and real Worker smoke GREEN; document integration and full capability exit pending.**

Immutable resolved closures, application, higher-order Values,
wrong-arity diagnostics.

### P0014 --- Symbolic operations

**Status (2026-10-13): PARTIAL / selected symbolic `diff` and derived FunctionValue via actual SymPy GREEN; remaining symbolic operations and exit pending.**

diff/integral/sum/solve/limit according to OperationSpec symbolic-target
rules.

### P0015 --- Containers and linear algebra

**Status (2026-10-13): NOT AUDITED COMPLETE; initial contracts/probes are not a verified full container/linear-algebra path.**

List/Vector/Matrix semantics and backend error adaptation.

### P0016 --- Quantity/unit evaluator path

**Status (2026-10-13): NOT AUDITED COMPLETE; unit/Quantity evaluator path remains on the roadmap.**

Compose Quantity with ordinary Values; backend capability limited to
officially supported unit behavior.

### P0017 --- Statistics/regression/distributions

**Status (2026-10-13): NOT AUDITED COMPLETE; statistics/regression/distributions remain on the roadmap.**

Use natural backend (often NumPy/SymPy) behind stable public Values.

**Exit Phase C:** evaluator passes its contract tests with no persistent
task scope. **NOT YET MET AS A FULL-PHASE EXIT:** selected paths have passed, but P0015–P0017 and broader P0014 coverage remain.

## Phase D --- Semantic document runtime

### P0018 --- Parser/grammar alignment

**Status (2026-10-13): PARTIAL / selected PEG source paths tested; grammar/i18n RED probe outstanding.**

Adjust PEG grammar only where frozen semantics require it.

### P0019 --- AST → Semantic Resolution

**Status (2026-10-13): PARTIAL / selected lexical and symbolic argument-role resolution; complete generic AST resolution and normative audit pending.**

Resolve lexical binders, symbolic targets, nearest predecessor and free
symbols.

### P0020 --- Writer/binding analysis

**Status (2026-10-13): PARTIAL / selected document-writer/source binding and fail-closed provider tests; full document-source coverage pending.**

Implement exact parse/structural writer boundary and no
success-dependent fallback.

### P0021 --- Dependency model v2

**Status (2026-10-13): PARTIAL / selected binding, dependency and task batch seams GREEN; full DocumentRuntime exit unverified.**

Generate bindings + DAG from the same semantic analysis.

### P0022 --- Calculation state v2

**Status (2026-10-13): NOT CLOSED / selected outcome envelopes and result plumbing exist; full calculation state projection pending.**

idle/running/success/error/dirty/blocked as derived runtime state.

### P0023 --- Reactive invalidation

**Status (2026-10-13): NOT CLOSED / need real-document downstream invalidation regression.**

Provider changes, structural mutations, downstream invalidation.

### P0024 --- Evaluation orchestration

**Status (2026-10-13): NEXT INTEGRATION FOCUS / selected async batch dispatch GREEN; wire into actual DocumentRuntime.**

DocumentRuntime sends resolved instructions/Values to evaluator in
correct dependency/order semantics.

### P0025 --- Async epoch/generation protection

**Status (2026-10-13): PARTIAL / selected revision-stale guard tests GREEN; full runtime generation/epoch stress tests pending.**

Pure, volatile and external results use identical stale-result
protection.

**Exit Phase D:** the 53+ normative architecture stress tests run
through DocumentRuntime. **NOT YET MET:** isolated/batch/Worker tests are not equivalent to this exit.

## Phase E --- Editing and presentation

### P0026 --- EditingSession commit boundary

Editor buffers are separate from authoritative source.

### P0027 --- Document transactions / Undo/Redo

Reversible authoritative changes; no runtime snapshots.

### P0028 --- Structural editing

Insert/remove/move/copy/duplicate, including task-boundary semantics.

### P0029 --- Position-dependent visible Values

Derived `getVisibleValues(task, position)`-style projection for UI
tools.

### P0030 --- Text VAR segments

VAR picker, positional resolution, exact/decimal/significant-figure
presentation.

### P0031 --- Formula/result presentation

Stable renderer consumes Value/diagnostic contracts, not backend
objects.

### P0032 --- Plot presentation

PlotSpec/data derived from Values; Plotly remains presentation only.

### P0033 --- Table semantics v1

Only after concrete Release-1 table requirements are fixed; preserve
state/presentation ownership rule.

## Phase F --- Persistence and reproducibility

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

### P0043 --- Full regression matrix

Python + JS + end-to-end + normative architecture cases.

### P0044 --- Performance baseline

Representative 100--500 block documents; dirty recalculation; large
symbolic/numeric cases.

### P0045 --- Worker/off-main-thread evaluation

Only if measurements justify it; architecture boundary should make this
transport change non-semantic.

### P0046 --- Offline packaging

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
-   **M4 --- Pure evaluator works:** P0017 (selected evaluator paths GREEN; milestone not yet closed)
-   **M5 --- Reactive document runtime works:** P0025 (next integration focus; milestone not yet closed)
-   **M6 --- Student editing/presentation works:** P0033
-   **M7 --- Save/load/export works:** P0037
-   **M8 --- Legacy Task Scope gone:** P0042
-   **M9 --- Release candidate:** P0050

## Governing rule

> Do not optimize the roadmap for preserving old code. Optimize it for
> reaching the frozen architecture through small, testable, green steps.

The old P07 work remains valuable prototype evidence and regression
knowledge. It is not the numbering authority for the new implementation
series.

