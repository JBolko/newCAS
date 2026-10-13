# P0021 Slice 53 — Selective semantic execution in DocumentRuntime

**Status:** locally GREEN. User Node 24 regression remains authoritative.

## Intent

After `x:=10; f(t):=t^2+3t; f(x)` evaluates to 130, editing `x:=3` must execute exactly `x` and `f(x)` and retain the previous immutable `FunctionValue` for `f`. Editing the body of `f` must, conversely, invalidate `f(x)` despite an unchanged provider ID.

## Implementation

- `DocumentRuntime.evaluateAndCommitDirtySemanticTask()` identifies unsatisfied/dirty/failed formula blocks from existing `block.calculation` slots and passes revision-stamped successful cached outcomes into the *existing* P0021 batch, dispatcher and commit gate. It maintains **no new persistent cache, document revision or global registry**. Caller supplies `createEvaluate` and the revision reader. Stale results are discarded, not automatically retried.
- `createRuntimeFunctionBatchEvaluator()` optionally consumes these same revision-stamped successful cached outcomes for provider input inside the ordered batch. Foreign block IDs, stale revisions and invalid Values fail closed. Never evaluates an upstream provider by name.
- `DocumentRuntime.setBlockSource()` invalidates downstream nodes according to both the old and new **P0021 semantic DAG** as well as the legacy graph during migration. This fixes a pre-existing gap: editing the *body* of `f` does not change the provider identity used by `f(x)`, but must still invalidate that dependent.

## Verification

1. Fresh document evaluates all three blocks: 130.
2. `x:=3` evaluates only `x` and `f(x)`: 18; `f` is reused.
3. No edit evaluates no blocks.
4. `f(t):=2t+1` evaluates only `f` and `f(x)`: 21.
5. Stale revision cannot commit.
6. Incorrect-revision provider caches are rejected.
7. A failed writer cannot supply a cached success or resurrect an old result.

## Deliberate boundaries

- Selection is based on existing `calculation.status`; this is not a new task scheduler or a second document authority.
- Scalar arithmetic is supplied by a test evaluator, not a newly verified Pyodide browser test.
- The full general-purpose operation evaluator and migration from `CASEngine.calculate()` remain future work. Only one-argument selected function examples and integer assignments are covered.
