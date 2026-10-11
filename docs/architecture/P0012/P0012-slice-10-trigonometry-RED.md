# P0012 Slice 10 — Trigonometry RED

## Design decision under test

- **Proposed document default: degrees** for introductory classroom work.
- The document/runtime is authoritative for the effective angle mode.
- The evaluator is pure and receives the **resolved effective** `angleUnit` in `EvaluationRequest.options` (`deg` or `rad`); there is no implicit evaluator default.
- UI presents and edits the document setting; it must not silently convert all displayed input behind the evaluator's back.
- No heuristic such as angles in degrees but functions in radians; it would make evaluation sensitive to visual/syntactic guesses.
- A future per-call override, if wanted, must be explicitly designed and resolved before evaluator invocation.
- Trigonometric expressions should retain exactness when entered exactly: `sin(30 deg)=1/2`, `sin(1 rad)` remains symbolic, `sin(0.5 rad)` is approximate. `sin(x)` must be representable without evaluating x.

## Architecture blockers intentionally exposed

- The current `validate_binary_expression_request` is expressly binary; do not sneak unary signatures into it by faking a second input. Decide a small shared signature validator based on current evidence.
- P0011 `SympyValueAdapter` supports integer, rational, approx, symbolRef, add/mul/pow, **not** canonical constants or Call. General trigonometry requires those public expression nodes to be specified according to P0005 (possibly a dedicated follow-on slice). Do **not** invent a private representation or coerce an exact result to a Float.
- These RED tests are architectural pressure, not a specification of how an unresolved frontend parser spellings `deg` / `rad` must work.
- Do not put angle settings in task-global mutable SymPy state.

## Execution

From repository root:

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-10-trigonometry-RED.zip" -DestinationPath "." -Force
python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
```

Expected initial RED: `ModuleNotFoundError: src.python.evaluator.scalar_trigonometry`; the existing 37 P0012 tests should remain green. No production code is changed.

## GREEN staging

1. Choose the public Call/constant representation and verify P0005 contract compatibility; implement P0011 roundtrip pressure separately.
2. Add a selected unary sine handler, using effective angleUnit explicitly from request options; do not introduce a global default.
3. Extend to cos/tan only after sine with symbolic, exact and approximate arguments works.
