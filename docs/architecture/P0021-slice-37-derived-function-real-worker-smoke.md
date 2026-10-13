# P0021 Slice 37 — Derived FunctionValue in real Pyodide Worker

## Scope

Browser-only integration proof. After Slice 34 compiles a selected symbolic
`diff` P0010 request, the existing Worker dispatches it to Python/SymPy.
Slice 36 wraps the returned `ExpressionValue` as a new immutable `FunctionValue`
with the original lexical binder; Slice 29 applies that function using the
same Worker for `add`/`multiply`/`power`. No runtime/registry/Python changes.

## Assertions

- `x := 12` does not capture the lexical parameter of `f(x):=x^3+4x`.
- The *actual* Worker derivative can be materialized by Slice 36 as a `FunctionValue`.
- Calling it via existing selected Worker arithmetic yields `f'(0)=4`, `f'(1)=7`, `f'(12)=436`.
- Browser, worker and module URLs have Slice 37 cache revision tags.

## Run

`node --test tests/js/p0021-derived-function-worker-browser-contract.test.mjs`

`node --test`

Run `python -m http.server 8000` from the repository root, then open
`http://localhost:8000/tests/browser/p0021-derived-function-worker-smoke.html`.
Click **Kør rigtig Worker-test** and report logs. The Node tests validate
fixture contract, **not real Pyodide execution**. No actual browser run was
performed by the patch author. Browser loads Pyodide/SymPy over the network.

## Limits

The fixture supplies a pre-materialized source `FunctionValue` and explicitly
selected instructions. Full automatic DocumentRuntime integration and parsing
`g(x):=diff(f(x),x)` are **not** in this slice.
