# P0021 Slice 31 — source-classified document function call

Compose P0020 `deriveSourceSemanticSnapshot().blocks[].calls[]` with the existing P0021 Slice 30 `evaluateProviderFunctionCall`. The caller supplies the exact source block, call-occurrence index, and source name, plus **already materialized** Value arguments and an attested provider Value. Neither this adapter nor Python looks up a function by name.

- `classification: document-writer` with one candidate is required; ambiguous catalog/document collisions fail closed.
- The P0020 provider identity is authoritative even if a previous writer has a successful cached Value. Missing/failed selected providers never fall back.
- Task scope, caller block and provider ID/name must match the document-attested envelope. No extra providers accepted.
- The adapter does not own snapshot freshness; DocumentRuntime must supply a same-revision snapshot and envelope. This slice neither changes DocumentRuntime nor automatically parses `f(x)` into a selected call.
- The Slice 30 evaluator and arithmetic pathway are reused unchanged. No new registries, document variable dictionaries, Python scope, or Worker changes.

Test: `node --test tests/js/p0021-bound-source-function-call.test.mjs`; regression: `node --test`.

Next: bind the source-call occurrence into the document evaluation batch, with revision consistency; then test the complete user-defined function call in a real Worker.
