# P0021 Slice 1 — Semantic snapshot to dependency-graph projection

Status: **bounded GREEN locally** (8/8 new tests). Full checkout regression pending.

Source of truth: `deriveSourceSemanticSnapshot` (P0020 Slice 5). The new
`projectSemanticDependencyAnalysis(snapshot)` reads **already resolved**
`references[].binding` and projects the same provider IDs into a
`DependencyGraph` and `bindings: Map<blockId, Map<name, providerId>>`.
This shape can be compared using existing `findBlocksWithChangedBindings`.

It does **not** parse source, choose writers again, infer function-call
binding, evaluate Python, write to DocumentRuntime, or mutate snapshots.
Unresolved ordinary names create no edge; explicit provider references must
refer to a snapshot block. A mathematically failing writer still binds.

Known limitations: public FunctionValue calls, operation-scoped source
references and separate per-occurrence binding positions are not yet included.
The currently derived P0020 snapshot tracks ordinary source-variable reads
and classifies call targets separately; this slice does not silently merge
those two concepts. Future P0019/P0021 integration must respect this.

Use from repository root:

```powershell
Expand-Archive -LiteralPath ".\P0021-slice-1-semantic-dependency-bridge.zip" -DestinationPath "." -Force
node --test tests/js/p0021-semantic-dependency-projection.test.mjs
node --test
```

Expected: 8 new JS tests; 431 total if previous 423 remain unchanged.
Python untouched: latest 191 P0012 + 16 P0011 = 207.
