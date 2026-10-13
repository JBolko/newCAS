# P0021 Slice 16 — Slice 15 regression-test adjustment

Slice 16 adds `probe.scalar.sin` to the transport allowlist. An older Slice 15 regression test asserted that sine was *unsupported*, causing the now-intended, earlier argument validation (`angleUnit`) to fail the old error-message assertion.

The revised Slice 15 test uses `probe.scalar.divide`, an evaluator not selected/supported by Slice 16, to verify the **same invariant**: unsupported capabilities are rejected before Python invocation. It continues to check that no selected payload was sent to Python. A separate Slice 16 test covers the required explicit `deg`/`rad` option for sine.

Only a JavaScript test and this note are changed. No runtime allowlist, Python code, mathematical behavior, or browser test was changed.

Local isolated verification against the *actual Slice 16 selected-pyodide-runtime.js*: 5/5 tests pass. Run full `node --test` in repository to verify all 551.
