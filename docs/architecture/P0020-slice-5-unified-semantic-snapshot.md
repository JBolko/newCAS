# P0020 Slice 5 — unified derived semantic snapshot

**Status:** locally GREEN: 8/8 tests, assembled against exact source files from the uploaded repository snapshot and prior ZIP slices. User checkout full regression is pending.

## Purpose

`deriveSourceSemanticSnapshot(blocks, parse, taskScopeId)` is a **pure composition** of P0020 source analysis, source bindings, and callable candidate classification. It consumes one parse pass for each formula block, uses one writer table, and aligns all returned block facts by identity. It is not a new independent resolver or registry.

It returns immutable derived facts: task scope, established writers, and per-block position, syntax-error status, variable references and callable candidates. It deliberately does *not* choose between a user function and an operation when both are present. It does not evaluate, construct public Values, create diagnostics, or mutate DocumentRuntime.

## Invariants
- Writer binding does not fall back on mathematical evaluation failure.
- Parsing errors establish no writer and yield no usable references.
- One task scope and ordered block positions are authoritative inputs.
- OperationSpec catalog is read-only capability metadata, not a second runtime registry.
- Same-name callable collisions remain explicit, without guessed precedence.

## Verification from repo root
```powershell
Expand-Archive -LiteralPath ".\P0020-slice-5-semantic-snapshot.zip" -DestinationPath "." -Force
node --test tests/js/p0020-derived-semantic-snapshot.test.mjs
node --test
```

Eight new JS tests; expected whole JS suite = **423** if Slice 4's nine tests had already passed (415 + 8). Existing Python 191 P0012 + 16 recent P0011 unchanged. This is a bounded test of wiring between layers, NOT an end-to-end evaluator test.
