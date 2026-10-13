# P0021 Slice 4 — ordered evaluation request contract

Pure adapter `prepareSemanticEvaluationBatch(snapshot, analysis, schedule, sources, cachedIds)` creates frozen requests `{blockId, taskScopeId, source, providers, upstream}` in the *already* topologically sorted execution order. The `providers` carry positional provider IDs assigned in P0020 and projected in P0021 Slice 1. No new name lookup.

- `sources`: `Map<blockId, canonical source string>`. Only scheduled blocks need sources.
- `cachedIds`: explicit IDs with valid previous outcomes for upstream dependencies outside this recomputation. **The caller**, not this adapter, must prove their outcome/version is current.
- Every upstream dependency must precede its consumer within the batch or be listed in `cachedIds`.
- Cycles and blocked nodes are never dispatched; they remain reported separately.
- Parsing errors in scheduled blocks reject the batch (error handling is a future runtime integration contract).
- The adapter does **not** invoke Python, prepare Symbolic IR/Values, choose callable targets, transport requests to Web Workers, or mutate DocumentRuntime.
- This is a sequential task *description*: success/failure of one task must be interpreted before evaluating the next. A failed provider must not silently fall back to another definition.

Next slice should define the outcome/version handshake and explicitly how missing/failed provider outcomes block dependent tasks, before any actual evaluator dispatch.
