# P0019 Slice 4 — positional source-name binding

**Scope:** bounded pure lookup against caller-supplied, structurally screened
writer descriptors. No changes to DocumentRuntime, Python, OperationSpec,
P0005–P0010 or parser. No execution-history lookup.

`resolvePositionalName` chooses the nearest established writer before a
source position *within the same task*. A failed writer is still a writer:
availability and cached results play no role in selection. Operation-local
and lexical identities shadow document writers. Without a writer, resolution
yields a task-local free-symbol identity.

Writer establishment itself is NOT handled here: the `established` flag must
come from syntactic/structural document analysis. The broader P0019/P0020
integration still needs writer source analysis, distinct definition/RHS
positions, function captures, and a real DocumentRuntime connection.

This slice does not re-resolve a materialized Value and does not claim
full end-to-end text -> evaluator operation.

From repository root:
```powershell
Expand-Archive -LiteralPath ".\\P0019-slice-4-positional-binding.zip" -DestinationPath "." -Force
node --test tests/js/p0019-positional-name-resolution.test.mjs
node --test
```
**Expected:** 10 new tests, total JS 378 (prior 368), subject to user's
repository verification. Python untouched; prior 191+16 remains latest GREEN.
