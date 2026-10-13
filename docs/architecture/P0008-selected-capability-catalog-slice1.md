# P0008 — Selected OperationSpec Catalog, Slice 1

**Status:** local JS tests GREEN; full user checkout test pending.

This slice adds a **small exploratory catalog of tested selected capabilities**:
`integrate`, `tangentline`, `arclength`, and `surfacearea` (the latter is
**surface of revolution about the x-axis**, not general z=f(x,y) area).

The module reuses the frozen P0008 `operationSpec` constructor unchanged and
keeps internal `probe.symbolic.*` evaluator IDs explicit. It does **not** claim
that all operations are registered, that the aliases/language name policy is
resolved, or that the current DocumentRuntime uses this catalog. No Python,
parser, DocumentRuntime, source resolution, or transport contract changes.

IMPORTANT: the P0012 `integrate` Python handler currently accepts **one
selected signature at a time** (two or four inputs); this catalog's multiple
signatures are **declarative only**. A later dispatch/resolution step must select
one complete signature before crossing into that handler. Do not hand the
multi-signature catalog spec directly to the selected handler.

`surfacearea` has intentionally not been renamed to `surfacearea_revolution`:
that public language-design decision is pending and must not be silently made.

Run from repo root:

```powershell
Expand-Archive -LiteralPath ".\P0008-selected-capability-catalog-slice1.zip" -DestinationPath "." -Force
node --test tests/js/selected-operation-catalog.test.mjs
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected full JS count **348** (341+7), P0012 **191**, P0011 **16** if unchanged.
P0018 remains parked. Future P0019 will consume roles and resolve semantic
identities without operation-name-dependent special cases.
