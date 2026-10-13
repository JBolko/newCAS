# P0021 Slice 55 — Asynchronous structural edits and generation guard

**Status:** focused GREEN (5 new, 19 focused JS tests). Full Node 24 suite pending user verification.

## Contract under test

The authoritative DocumentRuntime remains responsible for source, ordering, calculation state and generation. A pending semantic evaluation must not commit after an edit to the same task, even if its already computed mathematical answer is correct. A `stale` result cannot schedule its own retry.

## Tested operations

Starting from `f(x):=x^2+3x; f(10); f(x):=2x+1; f(3)` and a successful initial calculation (130, 7), force `f(10)` dirty and suspend its next semantic evaluation. While pending:

1. Remove first definition: suspended batch is stale; explicit subsequent round yields unresolved `f(10)` and preserves 7.
2. Move the second definition above `f(10)`: suspended batch is stale; explicit subsequent round yields 21 and 7.
3. Edit first function body: suspended batch is stale; explicit subsequent round yields 140 and 7.
4. Insert a new overriding function before `f(10)`: suspended batch is stale; explicit subsequent round yields 31 and 7.
5. Change an externally supplied revision during a pending semantic evaluation: stale is returned without retry or commit.

All cases use the actual DocumentRuntime, semantic task batch, source resolution, immutable FunctionValues and generation/revision checks; arithmetic operations use the existing selected JavaScript arithmetic probe rather than Pyodide. Tests explicitly initiate subsequent rounds; stale never invokes another round itself.

## Limitations

This is a controlled deferred-promise concurrency test, not real Web Worker scheduling or UI event-loop stress. The broader scheduler and multiple simultaneous overlapping runs require additional tests. No production changes or architecture amendments were needed.
