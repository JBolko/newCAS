# P0021 Slice 48 — Semantic result commit in DocumentRuntime

**Status:** local GREEN; full Node 24 suite pending user verification.

## Motivation

Slice 47 intentionally returned semantic outcomes without mutating the authoritative DocumentRuntime. Slice 48 adds a narrow commit step to that existing runtime; no duplicate registry, graph, calculation-state store, or Python task scope is introduced.

## Contract

`DocumentRuntime.evaluateAndCommitSemanticTask(taskId, options)` obtains the same P0020/P0021 batch as `dispatchSemanticTask`, calls the same sequential dispatcher, then commits completed outcome Values or structured failures into `block.calculation`.

Before dispatch, runtime captures all task formula block identities, order, sources, and calculation generations. Commit occurs only if caller-owned revision has not changed and the captured authoritative task has not changed. An edit or structural mutation while awaiting the evaluator yields `kind:'stale'`, with no commit. Incomplete (`stale`, `missing-upstream`) dispatch likewise never commits partial outcomes. All success Values must satisfy the frozen P0005 contract before any block mutation.

The existing `markBlockDirty()` generation behavior is preserved. No `CASEngine.calculate` is called by this method. Existing legacy `calculateBlock()` remains unchanged during migration.

## Evidence

Seven tests cover success, failure, late source edit, structural insertion, caller revision change, invalid Values without partial commit, and task separation. Local 108/108 focused runtime/protocol tests green.

## Scope and next step

This slice provides the commit boundary, **not** autonomous source-definition materialization or a full live document evaluation loop. The caller still supplies an evaluator callback and revision token; follow-on integration must derive the semantic evaluator from authoritative source and current provider Values. No new architecture decision is required by this slice.
