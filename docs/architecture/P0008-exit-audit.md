# P0008 — Exit Audit

**Status:** COMPLETE / GREEN  
**Closure baseline:** 220/220 JS tests  
**Production contract:** `src/js/operations/operation-spec.js`

## Exit criterion

Roadmap P0008 requires:

> representative operations described without DocumentRuntime special cases.

**Result: MET.**

## Evidence

The permanent test suite covers representative OperationSpecs for ordinary,
symbolic, scoped, overloaded and variadic operations. Generic test consumers can:

1. select a semantic signature by arity;
2. expand a final variadic argument;
3. read Value/symbolic/scoped argument policy;
4. read explicit `scopeOver` relationships;
5. obtain evaluator dispatch identity;
6. read purity/volatility;
7. read diagnostic-adaptation identity.

None requires task ID, block ID, document order, dependency graph, dirty state,
history, provider identity, embedded resolver callbacks or evaluator callbacks.

## Pressure history consolidated

During P0008 two genuine contract gaps were found and fixed locally:

- scoped arguments needed explicit `scopeOver` relationships;
- one fixed argument list could not represent multiple semantic call forms or
  variadic calls, so the contract gained complete `signatures` and final
  `variadic` argument metadata.

The exit-pressure and final-boundary audits then passed without production changes.

No changes to P0005 Value, P0006 identity or P0007 Semantic IR were required.

## Forward checks

These are not unfinished P0008 work. They are integration invariants for later
phases.

### P0019 — Semantic Resolution

Verify that symbolic/scoped argument roles and `scopeOver` are consumed
generically from OperationSpec.

Reject permanent logic equivalent to:

```text
if operationId == "diff" ...
if operationId == "integrate" ...
```

when that logic merely reproduces P0008 resolution policy.

Resolution allocates/applies P0006 identities and records the result in P0007 IR.
OperationSpec itself never performs resolution.

### P0014 — Symbolic evaluator operations

Verify that evaluator implementations receive already-resolved meaning. They may
dispatch by `evaluatorId` and implement operation mathematics, but must not recover
document lookup/scope policy.

For bounded integration, `lower` and `upper` remain ordinary Values, including
symbolic expressions such as the upper `x` in:

```text
F(x) := integrate(f(x), x, 1, x) + 5
```

### P0009 — Diagnostics

`diagnosticAdapterId` remains an opaque hook identity. P0009 defines structured
diagnostic codes and parameters; do not retrofit backend error strings into
OperationSpec.

## Closure result

```text
P0008 OperationSpec v1: COMPLETE / GREEN
Full JS suite:          220 / 220
Exit criterion:         MET
```
