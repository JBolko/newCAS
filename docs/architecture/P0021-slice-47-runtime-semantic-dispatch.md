# P0021 Slice 47 — DocumentRuntime-owned semantic evaluation batch

Status: Node targeted GREEN (91/91 including existing runtime suites); full user Node 24 suite pending.

## Purpose

The existing `DocumentRuntime` already owns authoritative source order and can
project P0020 binding facts (Slice 45) and invalidate calculation state on
semantic edits (Slice 46). Slice 47 adds `prepareSemanticTaskBatch` and
`dispatchSemanticTask` methods **to that same existing runtime**. Both reuse
P0021 `orderSemanticRecomputation`, `prepareSemanticEvaluationBatch` and
`dispatchSemanticEvaluationBatch`. There is no new runtime, registry, scope,
name binding mechanism, Python fallback, or new evaluator protocol.

`prepareSemanticTaskBatch(taskId, {recompute, cachedIds})` obtains a *fresh*
semantic projection and block sources from the current runtime. By default it
schedules every formula block; for selective recomputation, every omitted
provider must be an explicitly specified cached ID, whose actual successful,
revision-matching outcome remains subject to the existing P0021 dispatcher
checks. Invalid IDs and inferred/cross-revision cache hits are rejected.

`dispatchSemanticTask(taskId, {recompute, cachedIds, revision,
getCurrentRevision, evaluate, cachedOutcomes})` calls the same dispatcher as
P0021 Slice 6. It never invokes legacy `CASEngine.calculate`, never invents a
new evaluator, and never silently falls back to a later writer.

## Important boundary

**Slice 47 is a dispatch integration, not the final runtime migration.** Its
outcomes are returned but **not committed** into `block.calculation`, whose
revision/generation ownership must be integrated in the next slice. For now,
the caller owns opaque revision tokens and must advance them after any
source, structural or semantic change. The old `calculateBlock` path remains
in place for existing callers. This separation is intentional: a transient
transport result must not be mistaken for an authoritative current document
result. No frozen architectural contract is modified.

## Evidence

Seven new tests cover current P0020/P0021 bindings and topological order,
selective/cached provider dependencies, direct dispatch without CASEngine,
pre- and mid-flight revision invalidation, task isolation and fail-closed stale
caches. Combined existing runtime tests: 91/91 on locally available Node 22.
Full Node 24 regression and real Worker browser verification remain user-side.

## Next

Attach the dispatcher to DocumentRuntime's owned revision/generation and
commit success/error/blocked outcomes into the *existing* calculation state,
only after verifying the source and provider snapshot remains current. Then
materialize definition Values from current sources without test-harness
injection. Do not introduce a competing runtime or duplicate provider table.
