# P0021 Slice 2 — Conservative semantic recomputation plan

Pure `planSemanticRecomputation(oldProjection, newProjection, changedSources)`.
Projections come from P0021 Slice 1. The caller **must** supply IDs whose
source changed, since binding maps alone cannot detect a changed right-hand
side. The planner never parses, selects writers, evaluates, or mutates runtime.

Seeds: explicit source changes, inserted or removed blocks, and retained blocks
whose resolved binding maps have changed. Impact propagates transitively via
**both old and new** dependency graphs to avoid missing descendants when edges
are removed or replaced. `recompute` contains surviving/new IDs only; `removed`
reports obsolete block IDs for output disposal; `inserted` and `bindingChanges`
are diagnostic sets. These are unordered sets, **not an execution order**.

Limits: projected ordinary-variable dependency edges only. Function-call,
operation-local and symbolic-target semantics are not yet included. No cycle
handling or topological scheduling. No DocumentRuntime integration.

Run from repository root:

```powershell
Expand-Archive -LiteralPath ".\P0021-slice-2-recomputation-plan.zip" -DestinationPath "." -Force
node --test tests/js/p0021-semantic-recomputation-plan.test.mjs
node --test
```

9 new local tests GREEN; if 431 tests still pass, expected JS total **440**.
Python unchanged, last known **207**; expected combined **647**, subject to user verification.
