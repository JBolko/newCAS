# newCAS --- New Thread Handover

**Purpose:** Minimal authoritative handover from architecture design to
implementation.

## 1. Authority order

When the new implementation thread starts, use this precedence:

1.  `newCAS_ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md`
2.  `newCAS_ARCHITECTURE_STRESS_TESTS_FROZEN_v1.0.md`
3.  `newCAS_ARCHITECTURE_REVIEW_RESOLUTION.md`
4.  explicit ADRs created after the freeze
5.  current implementation roadmap
6.  current source code and tests as migration evidence
7.  historical architecture/prototype documents

If current code conflicts with the frozen architecture, **the code is
the migration object**. Do not silently weaken frozen semantics to
preserve legacy implementation.

## 2. Frozen architectural center

newCAS is a reactive mathematical document that uses CAS backends as
calculation engines.

The Document is the only authoritative mathematical state.

Document Runtime owns semantic resolution, positional bindings,
dependency/reactive state and Value availability.

The evaluator receives resolved instructions and input Values and
computes mathematics. It does not know task meaning, document order,
history, dirty graphs or UI structure.

Persistent Python Task Scope is legacy implementation state, not
mathematical authority.

## 3. First implementation work

Start with the roadmap, not by refactoring arbitrary old files.

Initial landmarks:

-   `P0001` confirm frozen baseline in repo;
-   `P0002` dependency/version inventory;
-   `P0003` backend capability probes;
-   `P0004` version/toolchain lock;
-   then Value/Semantic-IR/OperationSpec/diagnostic contracts before
    DocumentRuntime migration.

Do not create the implementation branch until the frozen documents and
capability-gate starting point are committed/available.

## 4. What to attach to the new thread

Attach the four architecture/roadmap documents plus **freshly
generated** repo snapshots:

-   `repomix-docs.md`
-   `repomix-tools.md`
-   `repomix-engine.md`

Generate them from the repository state at handover time.

Do **not** attach old repomix snapshots merely for history. Historical
snapshots can reintroduce superseded assumptions.

`repomix-handover.md` is optional and normally unnecessary because this
file plus the frozen documents replace it.

## 5. Implementation discipline

Each implementation step should state:

-   file/function/contract being changed;
-   architectural rule being implemented;
-   smallest relevant tests;
-   expected observable result;
-   migration/compatibility consequence.

Keep steps small and green.

Do not perform generic cleanup merely because a file looks messy.
Refactor legacy code when the frozen contract gives a concrete reason.

## 6. Architecture change rule

The roadmap is intentionally provisional and may change freely.

Frozen semantics do not.

If implementation evidence shows that a frozen rule is wrong or
impossible:

1.  stop the affected implementation;
2.  produce a minimal counterexample/capability result;
3.  make an explicit architecture decision/ADR;
4.  update normative specification and stress tests;
5.  version the architecture;
6.  resume implementation.

## 7. Historical context

The previous P07 series was valuable prototype work. It established
DocumentRuntime, dependency/binding analysis, dirty invalidation,
structural mutations and exposed the ghost-state problem of persistent
Python task scopes.

It is evidence and reusable code where compatible, but it is not the
numbering or semantic authority for the new implementation series.

The new implementation roadmap begins at `P0001`.
