# P0021 Slice 77 — active IR, task isolation and overlapping generations

Status: GREEN in local targeted Node tests. Full project suite must be confirmed in the user's checkout.

## Scope

Regression-only slice. No changes to production, frozen contracts, or scope/generation authority.

Exercises the **active Slice 76 resolved Semantic IR batch**, not the retired source-AST adapter, through `DocumentRuntime` and opt-in `createSemanticAutoScheduler`.

- Task A and B deliberately reuse source identifiers `a`, `f`, `g` and `answer`; independent captures yield `f(g(4)) = 146` and `154` respectively.
- Task A's first calculation is held in flight. Source changes `a:=20`, `a:=30`, `a:=5` are debounced; final value is `f(g(4))=149`, assignment `answer=150`.
- An old completed calculation reports `stale`, cannot roll back latest Value or independently schedule work.
- Task B's committed Value instance and visit count are unchanged by task A revisions.
- Scheduler disposal prevents delayed new evaluation while allowing in-flight stale rejection.

All calculations use the existing P0005 Values / OperationSpecs with an injected deterministic arithmetic backend, *not* the real Pyodide Worker. Browser Worker integration remains a separate acceptance responsibility.

## Verification

`node --test tests/js/p0021-ir-task-generation-stress.test.mjs`

Baseline: 912/912 full Node tests reported by user after Slice 76. Four new tests; expected 916 total if all dependencies are installed. No production files modified.
