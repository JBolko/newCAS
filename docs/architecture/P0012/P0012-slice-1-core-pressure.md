# P0012 — Slice 1: scalar arithmetic core probe

**Status:** exploratory baseline, not RED/GREEN evaluator implementation.

The probe uses P0011's disposable `SympyValueAdapter` directly with SymPy arithmetic. It verifies exact rational addition, large integer exactness, approximate arithmetic and identity preservation with two different `x` symbols.

It does **not** yet exercise P0010 `EvaluationRequest` → `EvaluationOutcome` or P0009 Diagnostics. This intentionally avoids inventing a public addition `evaluatorId` or a second dispatch mechanism.

## Contract gap to close before first evaluator RED

P0008 OperationSpec allows an opaque `evaluatorId`. Its representative test catalog defines such IDs for `sin`, `min`, differentiation, integration, etc., **not a normative addition ID**. P0010 defines envelopes, but not a Python bridge or an operation dispatch registry. Decide where core arithmetic instructions are defined and how they map to the P0008/P0010 evaluator boundary, reusing the existing contracts. Then write RED tests for exact addition, arity/type Diagnostics and success Value construction.

## Run from repository root

```powershell
python tools/probes/p0012_scalar_core_probe.py
```

No production files are changed. This diagnostic probe is disposable after the first evaluator slice is implemented.
