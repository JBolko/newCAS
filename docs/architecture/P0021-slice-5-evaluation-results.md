# P0021 Slice 5 — evaluation outcome gate

Adds `src/js/semantics/commit-semantic-evaluation-results.js` as a **pure** boundary after Slice 4's `prepareSemanticEvaluationBatch`. It does not invoke SymPy, modify DocumentRuntime, or redefine bindings.

- `beginSemanticEvaluationResults(batch, revision)` creates a revision-stamped immutable progress record.
- `nextSemanticEvaluationDecision(batch, state, currentRevision, cachedOutcomes?)` returns `evaluate`, `blocked`, `missing-upstream`, `stale`, or `complete`.
- `commitSemanticEvaluationOutcome(batch, state, currentRevision, outcome, cachedOutcomes?)` commits one ordered, portable result or failure; blocks success after a failed upstream.
- Success shape: `{blockId, status:'success', value: <portable JSON-shaped Value>}`. Caller remains responsible for validating the **canonical Value contract** before the gate. Failure shape: `{blockId, status:'failure', code, message}`. For a blocked task use `code:'UPSTREAM_FAILED'`.
- Cache shape: `Map<blockId, {revision, outcome}>`; entries from other revisions or with invalid outcome shape cannot satisfy prerequisites. This deliberately conservative policy does **not** yet reuse unchanged blocks across document revisions.
- Revisions are supplied and advanced by the *document owner*. This component cannot detect source modifications itself. The caller must check the current revision at every commit and discard stale work.
- Cycles/blocked blocks are excluded from Slice 4's ordered tasks and are **not** executed by this component. Worker lifecycle, retries, cancellation and cross-revision incremental reuse are deferred.

This explicitly gates the result contract; it does not yet hook into DocumentRuntime, Python or the Worker.
