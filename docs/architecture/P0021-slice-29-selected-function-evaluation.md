# P0021 Slice 29 — selected FunctionValue application into existing evaluator

## Scope

`evaluateSelectedFunctionApplication({fn,args,envelope,specs,evaluate})` reuses Slice 28's identity-safe `applySelectedFunctionValue`, lowers the **already substituted** expression Value to immutable selected Semantic IR, and delegates all operation calls to Slice 14's `evaluateNestedSelectedCalls` and thus its existing P0010 selection and evaluator callback.

This is a narrow integration, not yet full `DocumentRuntime` invocation or source-callable resolution. The document integrator must supply the materialized FunctionValue and **already resolved** argument Values. The gateway envelope must have no providers because all provider values must already have been materialized by the caller; no hidden resolution is permitted. Node tests use a callback stub and do **not** establish real Python/Worker integration for function application.

## Supported / unsupported

- Supported: expression-only `FunctionValue` applications that lower to a binary tree of integer, `add`, `multiply`, `power`, where the corresponding OperationSpecs are explicitly selected. A lone integer returns directly without backend dispatch.
- Unsupported (fail closed): free symbolic arguments (after substitution), other expression nodes (including `rational`, `symbolRef`, calls, derivatives), nonbinary arithmetic, implicit provider references, missing specs, wrong arity, or unbound captures.
- No source rewriting, Python task scope, fallback to older writers, new catalog, or mathematical simplification in the integrator.
- Revisions and the result blockId continue to be checked by the Slice 14/11 execution path.

## Tests

`node --test tests/js/p0021-function-evaluation.test.mjs`

`node --test`

Local check: seven new tests and all 25 Slice 26–29 tests GREEN. Full local reconstruction is not GREEN (three test files require the unavailable `peggy` dependency; legacy async engine test differs on Node 22). A full Node 24 checkout regression remains to be run by the user. If the prior verified baseline is 649, expect 656 tests after this slice.

## Next

A following slice should connect *document-owned function-call resolution* to this adapter. Separate real Pyodide Worker smoke for function application; do not assume this mock-based Node test proves it. General symbolic argument/body evaluation, function-to-function calls, and differentiation are later steps.
