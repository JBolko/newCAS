# P0021 Slice 16 — browser fixture correction

The browser smoke page constructed mutable integer objects, violating the
`SemanticIR.valueLiteral` immutable Value precondition. The failure arose
before any Web Worker call. This patch creates frozen Value fixtures and
regression-tests the exact fixture through `valueLiteral`.

Only browser test fixtures and tests are changed; the evaluation runtime,
mathematics, OperationSpec and Worker implementation are unchanged.

Run `node --test tests/js/p0021-angle-browser-fixture.test.mjs` and
`node --test`; then run the browser smoke page again. Successful Node tests
alone do **not** establish that the browser Worker test passes.
