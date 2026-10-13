# P0020 Slice 4 — callable candidate classification

**Status: candidate; run in user's checkout before GREEN claim.**

Connects P0020 Slice 3's *unresolved call name inventory* to the selected P0008
OperationSpec catalog and P0019's nearest-predecessor source-name lookup.
Returns descriptive candidates only, NOT a final name-binding decision.

A name can be a built-in operation, a prior document writer, both (explicit
`ambiguous`), or neither (`unresolved`). A prior writer is a *candidate* even
if its mathematical Value fails to evaluate; this slice does not determine
whether it is callable or a FunctionValue. Duplicate call occurrences are
already deduplicated in Slice 3; no AST occurrences or argument roles are
bound here.

This avoids inventing precedence between a user's function and a built-in
operation before implementing full P0019 callable resolution. Does not touch
Peggy, P0018, DocumentRuntime, Python or the frozen contracts.

Run:
```powershell
Expand-Archive -LiteralPath ".\P0020-slice-4-call-target-candidates.zip" -DestinationPath "." -Force
node --test tests/js/p0020-call-target-candidates.test.mjs
node --test
```

Adds 9 JS tests; if prior 406 tests green, full suite expected 415.
Python prior 191 + 16 unchanged.
