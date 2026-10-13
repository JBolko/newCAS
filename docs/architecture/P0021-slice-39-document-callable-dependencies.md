# P0021 Slice 39 — Document callable dependency projection

**Scope:** The first DocumentRuntime integration gap, without migrating the legacy `document-runtime.js` yet.

## Evidence / change

The existing P0020 semantic snapshot already includes callable source occurrences with authoritative `providerId`. The P0021 graph projection previously considered only variable references. Consequently `x:=12; f(t):=t^3+4t; f(x)` could miss its graph edge from `f` to the consumer: editing `f` would not necessarily invalidate `f(x)`.

The existing projection now consumes the P0020 call facts; it never re-resolves callable names, creates writers, or consults execution success. For a document-defined call, it includes the selected callable writer in the block's provider bindings and upstream DAG, alongside argument dependencies. Ambiguous call targets retain the dependency but must be refused by the subsequent explicit callable evaluator (no silent resolution). Old snapshot fixtures without a `calls` field remain compatible.

Six integration tests use the real Peggy parser and real P0020 source snapshot to verify the DAG, selective invalidation on `x` or `f` change, nearest-writer rebind, fail-closed invalid provider identity, and no fake built-in dependency. On the local reconstruction 33/33 target tests pass. This is **not** a fully executing DocumentRuntime: automatic Value materialization and dispatch of `x`/`f` writers remain to be wired in subsequent slices.

## Next

Integrate selected assignment and function definition writers with immutable evaluation outcomes, then evaluate consumer calls using *both* provider Values through the existing batch dispatcher. Reuse revision-stamped cache and P0005 Value boundaries. Do not resurrect persistent Python task scope.
