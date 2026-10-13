# P0021 Slice 52 — Document-owned integer variables and function calls

**Status:** GREEN for focused Node tests; full Node 24 suite to be confirmed in user's checkout.

## Goal

The existing `DocumentRuntime` owns all source and calculation state for:

```
x := 10
f(t) := t^2 + 3t
f(x)  -> 130
```

After `setBlockSource('x', 'x:=3')`, a separately requested semantic batch yields `f(x) -> 18`. No test-supplied provider Values, Python document scope, new runtime or persistent function registry are introduced.

## Change

- New `createSourceIntegerAssignmentTaskEvaluator` consumes an attested source writer and emits an immutable P0005 integer ExpressionValue. Deliberately only safe integer literals with no external providers.
- The existing `createRuntimeFunctionBatchEvaluator` (Slice 51) now delegates to that evaluator for `Assignment`, and selects the existing Slice 40 provider-bound variable-argument evaluator for `f(x)`. Literal calls still follow Slice 43.
- Provider outcomes are held only for the lifetime of the current batch. The sole authoritative result commit remains `DocumentRuntime.evaluateAndCommitSemanticTask` (Slice 48). No fallback to prior outcomes.

## Proof and limitations

Five additional Node regression tests cover source-owned Values and result commit (130), source edit and reevaluation (18), unresolved argument, forward-only resolution, and unsupported decimal assignment fail-closed. Run with:

```
node --test tests/js/p0021-runtime-variable-function-batch.test.mjs
node --test
```

The existing batch currently reevaluates all selected task blocks on the separately requested run; this slice does **not** claim selective *execution* of only `x` and `f(x)`. Only capture-free unary functions, scalar arithmetic in the selected evaluator, safe integer literal assignment, and one variable or integer-literal call argument are supported here. Automatic scheduler invocation and replacement of `calculateBlock` legacy CASEngine are still future work.

**Architectural contracts unchanged.**
