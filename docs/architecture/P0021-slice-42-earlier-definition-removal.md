# P0021 Slice 42 — removing the earlier function definition

**Status:** focused regression GREEN (5/5; local Node). **Scope:** positional source resolution and pure recomputation plan; no production changes.

Source document before deletion:

```text
f(x):=x^2+3x   # f1
f(10)          # ten: f1, expected 130
f(x):=2x+1     # f2
f(3)           # three: f2, expected 7
```

After deleting **f1** without moving the other blocks:

- `f(10)` has no preceding callable writer: P0020 marks it `unresolved`, with `providerId:null` and no candidate. It must not see `f2` positioned later in the source.
- `f(3)` still binds to `f2`, with unchanged dependency and expected value 7.
- P0021 identifies `f1` as removed; `ten` changes bindings and is the only retained recompute target. Cached `f2` and `three` remain valid.
- The existing selected-function evaluator refuses the unresolved call before invoking the math evaluator, even if someone tries to attest `f2` as its provider.
- Restoring `f1` rebinds and invalidates only `ten`, in addition to the inserted definition.

**Architectural boundary:** `unresolved` is a source-analysis classification, not yet a user-facing DocumentRuntime `EvaluationOutcome`. The runtime still needs to turn this failed binding into the appropriate structured diagnostic/invalid state and clear any prior success cache. Do not silently return a stale 130 or search for a later definition. This slice does not claim the full runtime behavior is implemented.

Run: `node --test tests/js/p0021-remove-earlier-function-definition.test.mjs`.
