# P0021 Slice 24 — Explicitly selected symbolic diff through Worker runtime

Date: 2026-10-13. Builds on the installed Slice 23.

## Boundary

The existing Pyodide runtime now admits *only* the selected evaluator `probe.symbolic.diff` in addition to its previous scalar allowlist. It loads the existing `scalar_differentiation.py` and delegates to the existing `evaluate_diff_request` through `evaluate_selected_gateway`. No second registry, new Python name binding, document state, source parsing or new Value format. Selected calls are still compiled by `compileSelectedSymbolicDiff` (Slice 23) and carried by P0021's existing Worker protocol.

The runtime additionally fails closed when the symbolic target is not an expression `symbolRef` or when instruction/options are nonempty. Python still independently validates P0008/P0010 contract and providers.

The Worker entry changes its versioned import to `slice24-symbolic-diff-v1` to mitigate stale browser-module loading; the enclosing page's Worker URL must also be versioned when creating a Worker.

## Files

- `src/js/evaluation/selected-pyodide-runtime.js`
- `src/js/evaluation/selected-pyodide-worker.js`
- `tests/js/p0021-symbolic-diff-worker.test.mjs`
- `tests/js/p0021-selected-pyodide-runtime.test.mjs` (update exact Python whitelist)
- `tests/js/p0021-selected-angle-unit.test.mjs` (update exact Python whitelist)

## Verification

- Five new Node tests (injected Pyodide stub): selected payload, allowlist, invalid target, options/instruction, cache-versioned import.
- In the reconstructed Repomix checkout, 505/505 runnable curated JS tests pass; 14/14 Python tests pass with `PYTHONPATH=src/python`.
- This does **not** claim real Pyodide execution in a browser. The injected Pyodide test checks dispatch/source loading and payload forwarding, not mathematical correctness. The actual Python diff handler was independently exercised in Slice 23.
- The reconstructed checkout omits `src/js/parser.mjs`, browser fixtures and installed `peggy`; a full `node --test` fails from these omissions, not from this slice. Your own checkout baseline prior to this slice was 622/622.

## Acceptance in user checkout

```powershell
Expand-Archive -LiteralPath '.\P0021-slice-24-symbolic-diff-worker-GREEN.zip' -DestinationPath '.' -Force
node --test tests/js/p0021-symbolic-diff-worker.test.mjs
node --test
```

If the user's checkout is unchanged, expect 627 tests (622 + five new), subject to actual verification. Browser smoke must test actual Pyodide in the Worker and version the Worker URL, not just its imported runtime.
