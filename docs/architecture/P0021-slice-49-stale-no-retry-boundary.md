# P0021 Slice 49 — Stale outcome is not a retry instruction

**Baseline:** Slice 48 (user-confirmed baseline before Slice 48: 768 JavaScript tests; Slice 48 expected 775, awaiting confirmation).

## Question
Can invalidated generations cause infinite reevaluation?

## Existing contract and observation

- `DocumentRuntime.evaluateAndCommitSemanticTask` returns `{kind:'stale'}` if the revision or in-flight document snapshot changed. The method does not retry or recursively schedule evaluation.
- `markBlockDirty` increments the generation on the transition to dirty, but returns if already dirty. Therefore repeated invalidation while dirty does not create an unbounded series of increments.
- The legacy `recalculateDirty` method walks the current block list once per explicit invocation. Its caller may invoke it again, but it contains no automatic stale-based while loop.
- These properties **do not prove** freedom from infinite retries in a future UI scheduler. A consumer must not interpret `stale` as an unconditional immediate retry. A scheduler should coalesce invalidations, make retries depend on a *new authoritative revision or explicit user action*, and test against edit storms and perpetual volatility.

## Tests

`tests/js/p0021-runtime-stale-no-retry.test.mjs` covers: external revision shift, source edit during awaited evaluation, repeated dirty notification, and an explicit fresh invocation after a stale result.

No new runtime mechanism is introduced. No production code changes. This test-only slice precedes the next implementation increment for definition Value production.
