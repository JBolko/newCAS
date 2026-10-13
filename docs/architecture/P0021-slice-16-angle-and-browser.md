# P0021 Slice 16 — selected sine and real Worker browser smoke

The selected gateway now explicitly permits `probe.scalar.sin` through the existing P0012 sine handler. The runtime adds `_unary_value_contract.py`, `_trigonometric_argument.py`, and `scalar_trigonometry.py` to its explicit source whitelist. No Python scope or source reparse.

`withSelectedAngleUnit(evaluate, 'deg'|'rad')` decorates only selected sine requests with P0010 `options.angleUnit`. The underlying Slice 9 compiler remains unchanged; this is an explicit per-evaluation policy, not a document-level setting implementation. Full settings propagation remains pending.

Browser smoke rechecks multiplication, radian sine, `sin(23+3*5)` in degrees, and exact `sin(90°)=1`. Run HTTP server from repository root; open `tests/browser/p0021-angle-worker-smoke.html`. Needs network to load Pyodide/SymPy. Node tests do not prove real browser operation.

The earlier Slice 15 browser smoke is not superseded as a diagnostic: it should still work after the Slice 16 runtime update. If it fails, capture its exact log.
