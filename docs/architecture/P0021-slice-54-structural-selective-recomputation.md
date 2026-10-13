# P0021 Slice 54 — Structural edits and selective semantic execution

**Status:** locally GREEN (7/7 new; 101/101 focused). User's Node 24 regression is authoritative.

## Question

Can the **existing DocumentRuntime** reuse successful immutable Values while inserting, deleting, moving, and editing positional function definitions, even when a formerly visible provider becomes visible again?

## Evidence

The regression constructs real authoritative DocumentRuntime blocks and evaluates them via `evaluateAndCommitDirtySemanticTask` and the existing P0020/P0021 semantically selected function batch. It checks **which block IDs actually reach the evaluator**, not merely the intended DAG.

Starting source: `f(x):=x^2+3x; f(10); f(x):=2x+1; f(3)` gives `130, 7`.

1. Delete later definition: only `f(3)` executes, now `18`; early function and `f(10)` retain their exact cached Value objects.
2. Reinsert a new later definition: only new writer and `f(3)` execute, yielding `7`; earlier Values remain untouched.
3. Delete first definition: `f(10)` becomes an error with a **null current Value**, with no forbidden forward fallback; later writer and `f(3)` stay valid and cached.
4. Edit the later definition: only it and its downstream call execute (`f(3)=10`); `f(10)` remains unchanged.
5. Move the later definition before `f(10)`: `f(10)` changes from 130 to 21 while `f(3)` retains the cached 7.
6. Move the later definition after `f(3)`: only `f(3)` recalculates, recovering 18 from the first definition.
7. Original batch: the exact ordered function definitions and calls produce 130 and 7.

## Boundary and decision

**No production change needed.** The existing `DocumentRuntime` mutations, binding snapshots, dirty calculation slots, and revision-stamped explicit batch cache already produce the intended behavior for this supported subset. No new state owner, provider registry, scheduler, or CASEngine bridge is introduced.

The evaluated subset remains one-argument calls, capture-free functions, and selected scalar expressions. The scalar arithmetic evaluator is a test double; this is a DocumentRuntime structural/caching integration test, not a new real-Pyodide browser verification.

## Next

Generalize source/argument support and exercise the same semantics under asynchronous Worker execution and moving blocks between tasks. Keep stale outcomes non-retrying and test revision checks at commit.
