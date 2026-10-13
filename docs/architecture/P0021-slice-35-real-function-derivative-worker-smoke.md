# P0021 Slice 35 — real FunctionValue derivative Worker smoke

**Scope:** browser verification only. No production code, schema, grammar, or registry changes.

Build an immutable FunctionValue with original lexical binder `x`, `f(x)=x^3+4x`.
Reuse Slice 34 `compileSelectedFunctionDerivative`, Slice 23 selected P0010 request, Slice 24 Worker allowlist, existing Python gateway and SymPy.

The real browser test checks: (1) original binder is target, not document `x:=12`; (2) returned ExpressionValue only uses original binder; (3) resulting exact expression evaluates at 0, 1, 12 to 4, 7, 436. Numeric probes validate mathematics but do not substitute for the binder assertion. No new `FunctionValue` derivative is constructed yet; the test proves only the derivative ExpressionValue.

Browser source URL, Worker URL, and Worker entry runtime import are independently versioned (the Worker entry already imports runtime with `?v=slice24-symbolic-diff-v1`); browser's module graph may still use cached shared dependencies in a long-lived session. Use a fresh tab/hard reload as necessary.

## Verify

`node --test tests/js/p0021-function-derivative-browser-contract.test.mjs`

`node --test`

`python -m http.server 8000` and open `http://localhost:8000/tests/browser/p0021-function-derivative-worker-smoke.html`.

The actual Pyodide browser run is **not locally verified**. This does not yet prove full DocumentRuntime integration or a derivative FunctionValue. It does prove the selected Math/Worker boundary when user confirms browser PASS.
