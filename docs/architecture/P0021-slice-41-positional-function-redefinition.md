# P0021 Slice 41 — positional function redefinition (GREEN)

## Purpose

A source document with `f(x):=x^2+3x`, `f(10)`, `f(x):=2x+1`, `f(3)` must bind calls to the nearest **preceding** writer. The expected mathematical outputs are `130` and `7`, respectively. The new definition must not retroactively affect `f(10)`.

## Verified boundary

Five Node tests exercise the **real parser**, P0020 source semantic snapshot, the existing P0021 dependency projection, old/new graph recomputation planning, topological scheduling, and batch preparation. Insertion triggers recomputation of the inserted definition and later call only; editing the earlier definition does not invalidate the shadowed later call; removing the inserted definition restores the original provider for the later call.

This is a graph/semantic integration slice, **not** a full DocumentRuntime execution test. `130` and `7` are expected mathematical values, **not** values computed by this test. Executing the two calls from document-produced function Values is the next vertical step. No production code, frozen contracts, revision ownership, or Python scope changes.

## Run

`node --test tests/js/p0021-positional-function-redefinition.test.mjs`

Then `node --test` in the supported Node24 checkout. Prior reported baseline: 726; expected new count: 731.
