# P0021 Slice 3 — Topological execution order

Pure `orderSemanticRecomputation(analysis, plan)` accepts the exact output of P0021 Slice 1 and P0021 Slice 2. It returns `{order, cycles, blocked}`. `order` is deterministic (document/graph insertion order for independent nodes); upstream targets precede their downstream targets. Providers outside `plan.recompute` are treated as already available from the existing document state, not scheduled again.

Cycles are not silently evaluated. Strongly connected cyclic components are reported under `cycles`; their downstream pending consumers are returned under `blocked`. No evaluation, retries, dependency rebuilding, parse, DocumentRuntime or Python change is introduced.

**Boundaries:** This is a scheduling policy only, not an assertion that actual source-defined dependencies can form cycles under current nearest-prior-writer semantics. Runtime cache correctness, stale-results, failed upstream evaluations, cancellation and asynchronous Worker delivery remain future contracts.

Run: `node --test tests/js/p0021-semantic-execution-order.test.mjs` and `node --test`.
