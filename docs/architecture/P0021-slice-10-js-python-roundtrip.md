# P0021 Slice 10 — JavaScript → Python integration test

**Purpose:** Verify that the *actual* P0021 Slice 9 compiler produces selections accepted by the *actual* P0021 Slice 8 Python gateway and existing P0012 scalar-add/P0011 SymPy adapter. No hand-written `selection` fixture in the Python test.

## Scope

- New Node fixture (`tests/integration/p0021_emit_selected_cases.mjs`) compiles immutable Semantic IR through the existing `OperationSpec` and `compileSelectedValueCall` APIs.
- New Python `unittest` launches Node to obtain those JSON selections and passes them unchanged to `evaluate_selected_gateway(..., evaluate_scalar_request)`.
- Tests exact arithmetic, provider-resolved Values, and fail-closed tampering of binding/evaluator identities.
- There is **no change to production implementation** in this slice. The only new files are tests and this note.

## Boundaries

This proves a *host Node → host Python* JSON contract with real SymPy computation; it **does not yet prove** a browser/Pyodide roundtrip, a Web Worker, a complete expression parser, symbolic/scoped arguments, or integration with DocumentRuntime.

## Run from repository root

```powershell
python -m unittest discover -s tests/python -p "test_p0021_js_python_integration.py" -v
node --test
```

Requires Node.js available as `node` on PATH and the existing P0012 Python dependencies (including SymPy).
