# P0011 — Slice 5 closure addendum: constants and calls

**Status:** COMPLETE / GREEN for the *bounded* Slice 5 extension, based on the user's report of **9/9** tests.
**Date:** 2026-10-11.
**Relationship:** Supersedes only the *deferred `constant` / `call`* statement in `P0011-exit-audit-FINAL.md` dated 2026-10-08. The original exit audit remains an accurate historical baseline (29 tests); the numeric transport decision in `P0011-slice-4-numeric-transport-decision.md` is unchanged.

## Implemented public transport (P0005 shapes)

- Constant: `{"op":"constant","name":"pi"}` and `{"op":"constant","name":"E"}`.
- Unary call: `{"op":"call","name":"sin"|"cos"|"exp"|"log","args":[<ExpressionNode>]}`.
- The listed `log` **node presently maps to the natural logarithm**, matching SymPy `log`.
- The allowlist is deliberately finite. The adapter rejects unrecognized constants, calls and unsupported arities. Do not infer support for all standard functions or all SymPy objects.
- Import uses `evaluate=False` for supported calls; the adapter performs no degree/radian interpretation and does not own execution semantics.
- Symbol references keep their P0006 semantic identities through the existing disposable mapping. A user-defined symbol named `pi` or `E` remains a symbol reference; its spelling does not transform it into a constant.
- `E` as a mathematical constant is not the same as a user-defined identifier `e`. Exact names and case are part of the current transport representation.

## User-facing `log` vs adapter `log`: explicit naming decision

**Agreed user-facing policy for newCAS:** `log(x)` denotes **base-10** logarithm; `ln(x)` denotes **natural** logarithm; `log10(x)` may be offered as an unambiguous alias.

**Compatibility constraint:** This policy is **not implemented by Slice 5**. The existing internal call node named `log` still means natural logarithm. Do **not** silently change its meaning: that would reinterpret serialized Values and risk breaking existing adapter tests.

The parser / language normalization boundary, which will be addressed with P0012 and later parser integration, must map these surface forms to explicit backend-independent semantics. A possible non-breaking implementation is:

- surface `ln(x)` → existing natural-log `call(name="log",args=[x])`;
- surface `log(x)` or `log10(x)` → a **new explicit base-10** operation representation, subject to a dedicated contract and regression test, or a carefully specified exact transformation such as `ln(x)/ln(10)` (using current Value constructors), with no accidental floating-point conversion.

The two routes are design alternatives, **not** implemented behavior. Document-level locale or i18n may control *display spellings* and localized help, but must never silently change what a persisted expression means. Locale changes alone must not reinterpret stored mathematics.

## Angles and computation boundaries

DEG as document default and RAD as an explicit alternative is a P0012/DocumentRuntime policy, **not** an adapter rule. Direct/symbolic calls must not acquire hidden state inside SymPy or P0011.

This closure does not claim support for `tan`, inverse trigonometric functions, log-base-10, units, arbitrary calls, derivative or solve results, FunctionValue, RelationValue, list/set/matrix shapes, or full end-to-end execution.

## Evidence and verification

- Prior P0011 core audit: 29/29 desktop and pinned Pyodide; 323/323 Node tests **at the time of that audit**.
- P0011 Slice 5: 9/9 tests reported GREEN by user on 2026-10-11.
- P0012: 37/37 pre-trigonometry, with expected RED missing `scalar_trigonometry` import, per user's previous output.
- **Not yet evidenced:** 38 combined adapter tests in pinned Pyodide, or a new complete combined run of 38 P0011 + 37 P0012 + 323 JavaScript.
- Therefore P0011 is **re-closed within its defined ExpressionValue adapter scope**, not certified for all future Value families or runtimes.

## Continuation into P0012

1. Implement `sin` as selected unary operation with explicit angle option and no persistent backend angle state.
2. Keep `sin(x)` with semantic identity and inspect exact DEG/RAD conversion behavior.
3. Establish base-10 `log` surface mapping in a separate syntax/operation slice; do not alter the P0011 `log` node silently.
4. Re-run pinned Pyodide regression when changing adapter code again, and consolidate tests when P0012 checkpoint work allows.
