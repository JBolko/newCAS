# P0005 — Slice 20 acceptance and complex transport scope

**Date:** 2026-10-11
**Status:** P0005 remains COMPLETE/GREEN; Slice 20 is **accepted** as a compatible Value-v1 extension in the tested scope. This document supplements, but does not replace or silently revise, `P0005-value-contract-v1.md`.

## Accepted Slice 20 contract

The previously proposed `P0005-P0012-slice-20-set-extension.md` is now accepted:

- Interval endpoints can be the boundary markers `{"bound":"negative-infinity"}` (lower only, open) and `{"bound":"positive-infinity"}` (upper only, open). They are **not** scalar Values or ordinary numeric infinities.
- `SetValue` gains `setKind:"union"`, with `sets` containing at least two SetValues. Its deterministic transport ordering is not a claim of full mathematical normalization.
- The same serialized mathematical set can be rendered using Danish `]a;b[` or other locale conventions. Display strings are **not** the canonical Value representation.
- Ordinary approximations must still validate finite decimal strings and optional positive integer `precisionBits` under the existing P0011 numeric transport decision. The public encoding keeps that information independent of set boundaries.

**Acceptance evidence (user checkout):** `node --test` **331/331**, P0012 suite **143/143**, recent P0011 slice suite **9/9**, reported 2026-10-11 after Slice 20d. This accepts the actual tested SetValue extension; it does **not** claim complete `ConditionSet`/`ImageSet`/set-algebra support or rerun of the original 29 P0011 tests in this same session.

## P0011 complex scalar extension (this package)

The P0005 ExpressionValue tree already permits complex expressions using add, mul, rational and constant nodes. P0011's finite public constant whitelist now also includes **`I`**, representing the imaginary unit `sp.I` exactly.

Examples: `I`, `2 + 3*I`, `1/2 - I`, and approximate complex components can round-trip through the adapter. Existing P0006 symbol identities remain distinct; arbitrary unregistered SymPy symbols remain rejected.

`I` is a mathematical constant, **not** a `free-symbol` inferred from its display spelling. The existing JS P0005 constant-node validation accepts this new constant name without a schema change; valid constant *names supported by P0011* remain a deliberately finite whitelist.

This is **not yet** the real/complex document-domain setting or a promise of complex `solve`, `sqrt`, all complex functions, or rich complex sets. Complex domain selection belongs to the DocumentRuntime/P0012 request policy and must be explicitly tested next.

## Verification and rollout

The new seven Python tests pass locally, with the reconstructed P0012 suite at 143/143 and P0011 slice tests at 16/16 (9 prior + 7 new). JS previously had 331/331 in user's checkout; a full 331-test JS run against this package remains for the user to confirm. A pinned Pyodide 314.0.7 regression run should be done before declaring the expanded P0011 scope browser-verified.

Install from repository root and run JavaScript first:

```powershell
Expand-Archive -LiteralPath ".\P0011-slice-6-complex-transport-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

No modifications to the historical exit-audit evidence are made. The next P0012 slice should make real/complex solution-domain selection explicit; it should fail cleanly whenever the result cannot be represented by existing public Values.
