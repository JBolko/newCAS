# P0003 — Backend capability matrix

**Status:** COMPLETE / GREEN  
**Date:** 2026-09-28  
**Scope:** Backend capability evidence only. No DocumentRuntime, Value-contract, parser, UI, or migration decisions are introduced here.

## Tested backend chains

| Chain | Pyodide | Python | SymPy | Role |
|---|---:|---:|---:|---|
| A | 0.26.1 | 3.12.1 | 1.12 | legacy/reference |
| B | 314.0.7 | 3.14.2 | 1.14.0 | candidate |

The probes execute SymPy directly inside Pyodide. They do not route through the legacy `run_in_task` / persistent Python task-scope architecture.

## Capability matrix

| Area | Evidence | A vs B | P0003 conclusion |
|---|---|---|---|
| Symbol identity | ordinary Symbols, Dummy identity, substitution, bound/free variables | compatible | Required primitives are available. Document semantic identity must still be owned by newCAS. |
| Functions/capture | Lambda construction, application, substitution, alpha-equivalence observation | compatible | Backend primitives are sufficient; capture semantics remain a newCAS contract. |
| Solve / sets | FiniteSet, EmptySet, ConditionSet, Interval, Union/ImageSet, complex and parameterized results | mathematically compatible | Rich set results must be normalized by the future Value contract. |
| Limits | finite, infinite, one-sided, bidirectional, oscillatory | compatible | `dir="+-"` is the intended bidirectional API. Default SymPy direction must not define newCAS two-sided semantics. |
| Piecewise limits | jump and removable-discontinuity probes | same problematic behavior in A and B | Treat as a known backend limitation; do not blindly trust Piecewise limit results at branch boundaries. |
| Special values | `oo`, `-oo`, `zoo`, `nan`, AccumulationBounds | compatible | Public representation remains a P0005 decision. |
| Matrices | construction, determinant, inverse, eigenvalues, singular inverse, shape error | mathematically compatible | Exception module paths/messages are not stable public contracts. |
| Units | compatible conversion, incompatible conversion, dimensional-expression API | compatible where probed | `convert_to` does not itself reject incompatible dimensions; newCAS must validate dimensions explicitly. |
| Numeric paths | exact rationals, arbitrary precision numeric evaluation, floats | compatible | Required basic numeric paths available. |
| Statistical symbolic path | exact mean/spread arithmetic | compatible | Basic symbolic path available; this is not a full statistics API certification. |
| Serialization-relevant objects | expressions, equations, sets, intervals, matrices, functions | structural differences exist | `str`, `repr`, `srepr`, ordering and backend Dummy details are observations only, not stable public encoding. |
| Diagnostics | singular matrices, shape errors, non-existing bidirectional limit | semantic classes largely stable; module paths/messages vary | Diagnostic adapter must normalize backend errors rather than expose raw paths/messages. |

## Important observations

### Bidirectional limits

SymPy supports explicit bidirectional evaluation with `dir="+-"`. For `Abs(x)/x` at zero, both tested generations report that the limit does not exist because the left and right limits differ. Therefore newCAS does not need to implement the general two-sided algorithm by manually evaluating both sides.

The SymPy default direction is not the newCAS mathematical meaning of an unspecified two-sided limit. The evaluator wrapper must request the intended direction explicitly.

### Piecewise limits

The probes expose incorrect/unusable results at Piecewise branch boundaries in both tested generations. This is a backend limitation relevant to newCAS. It does not justify replacing SymPy's general limit engine; it requires a focused guard/adapter strategy when Piecewise expressions reach the limit operation.

### Units

`convert_to(meter, second)` can return the original quantity instead of signalling incompatible dimensions. Conversion success/failure therefore cannot serve as dimensional validation. The backend exposes dimensional expressions through the SI unit system; newCAS should compare/validate dimensions explicitly before conversion.

### Solve target validation

A structurally unsuitable solve target can produce `EmptySet` rather than an exception. newCAS must validate operation targets before invoking the backend. `EmptySet` must remain a legitimate mathematical result, not double as an invalid-target diagnostic.

### Backend error stability

Between SymPy 1.12 and 1.14, matrix exceptions moved module paths (`sympy.matrices.common` → `sympy.matrices.exceptions`), and message punctuation/details can differ. Stable semantic error adaptation must therefore not depend on fully-qualified backend exception paths or exact raw messages.

### Serialization and identity

Periodic solution sets showed differences in ordering and internal Dummy construction while remaining mathematically equivalent. Dummy indices are runtime-specific. Consequently raw `str`, `repr`, `srepr`, object ordering, or backend-generated Dummy identities must not become the public newCAS serialization or semantic identity model.

## Candidate conclusion

Within the capabilities required by P0003, the modern candidate chain (Pyodide 314.0.7 / Python 3.14.2 / SymPy 1.14.0) shows no identified mathematical regression relative to the legacy/reference chain. The observed differences are either backend-internal representation/diagnostic differences or limitations shared by both generations.

Candidate B is therefore suitable to proceed to P0004 dependency locking, subject to the normal reproducibility work in that task.

## Permanent probe asset

`tools/probes/backend_capability_probe.py` should be retained as a backend observation suite. Its purpose is to answer: **what does this backend actually do?** It is distinct from later newCAS contract/unit tests, which answer: **does newCAS satisfy its own contract?**

When evaluating a future Pyodide/SymPy generation, run the same capability suite and compare semantic observations rather than requiring byte-identical JSON.

## Known limitations / follow-up ownership

- P0004: reproducible version/developer baseline.
- P0005: public Value representation for sets, special values, matrices, quantities, rich results, and transport/serialization.
- P0006: newCAS-owned semantic identity/capture rules.
- Later evaluator work: explicit limit direction, Piecewise-limit guard, dimensional validation, solve-target validation, normalized diagnostics.
- Later offline/runtime work: probe/test sources must not be trapped by cache-first service-worker behavior; development/probe assets should be network-first/no-store or excluded from production caching rules.

## Exit criterion

P0003 exit criterion — **documented capability matrix and known limitations** — is satisfied.

**P0003 COMPLETE / GREEN.**
