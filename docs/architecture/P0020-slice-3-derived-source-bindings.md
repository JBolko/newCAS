# P0020 Slice 3 — derived source bindings from Peggy AST

**Status:** candidate; run in actual checkout before GREEN claim.

Builds read/binding facts from the already parsed P0020 Slice 2 block analysis.
Consumes the same P0019 nearest-predecessor resolver, and never consults
cached mathematical results, execution order or Python scope.

The first slice covers plain Variable occurrences in supported expression AST
nodes, function-parameter exclusion, failed writer non-fallback, task-local
free symbols, and separate unresolved call-name inventory.

**Deliberately NOT claimed:** complete semantic resolution of built-in operations
(`diff`, `integrate`, symbolic arguments); callable name binding; lexical scopes
beyond function parameters; arbitrary multi-statement blocks; DocumentRuntime
wiring; value materialization or Python evaluation. These need further P0019/P0020
slices with no silent guessing.

The returned `references` are *derived read facts*, not authoritative values.
Call targets are separated because a bare `sin` is not interchangeable with a
provider for `sin` or a Python registry callback.

Run from project root:
```powershell
Expand-Archive -LiteralPath ".\P0020-slice-3-derived-bindings.zip" -DestinationPath "." -Force
node --test tests/js/p0020-derived-source-bindings.test.mjs
node --test
```

Expected new 9 tests, overall JavaScript 406 (397+9), if baseline unchanged.
P0012/P0011 remain 191+16 last verified; Python unchanged.
