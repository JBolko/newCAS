# P0021 Slice 45 — DocumentRuntime-owned semantic projection

Status: targeted GREEN (83/83 across the seven new and existing runtime tests). Full Node 24 regression to be verified in user's checkout.

## Purpose

The existing `DocumentRuntime` owns authoritative ordered blocks, while its legacy `dependencyAnalysis` and `CASEngine` path have not yet been migrated. This slice adds a **read-only** `deriveSemanticTask(taskId)` method to the existing DocumentRuntime. It filters actual formula blocks by task in their current order and reuses the already established P0020 `deriveSourceSemanticSnapshot` and P0021 `projectSemanticDependencyAnalysis` functions. There is no new dependency model, name resolver, cache, value registry, or parallel runtime.

## Evidence

Seven tests cover nearest-preceding callable providers; removing the first definition (earlier call becomes unresolved, without forward fallback); deleting/reinserting later definitions; source modifications; text/task isolation; and the prohibition on mutation of legacy graph/calculation state. Existing runtime tests are retained.

## Deliberate non-goals

- Does **not** replace the legacy graph or CASEngine for `calculateBlock`.
- Does **not** materialize definition Values or commit evaluation outcomes.
- Does **not** claim end-to-end document recalculation on the new semantic path.

## Next integration gate

Connect the runtime's structural/source edit boundaries to P0021 semantic recomputation planning; retain a single document-authoritative revision. Only then attach batch outcomes to existing calculation state with strict stale/invalid binding protections.
