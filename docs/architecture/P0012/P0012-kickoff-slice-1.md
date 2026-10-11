# P0012 — Core scalar/expression operations

**Status:** IN PROGRESS — kickoff / Slice 1 contract pressure
**Normative basis:** Frozen Architecture v1.0; P0005–P0011 contracts.
**Next gate:** Decide the smallest evaluator-facing operation and verify its request/result behavior before writing production dispatch code.

## Objective

Implement pure scalar/expression calculation behind P0010's evaluator transport boundary, using P0011's disposable SymPy Value adapter. No new document state or source-name resolution.

P0010 defines `EvaluationRequest { evaluationRequestVersion: 1, evaluatorId, instruction, inputs, options }` and mutually exclusive success-Value / failure-Diagnostic outcomes. P0008 supplies opaque evaluator dispatch identity; P0011 translates supported ExpressionValues to/from backend objects.

## Slice 1 — proposed smallest vertical path

Begin with a **resolved scalar arithmetic invocation** using already materialized ExpressionValue inputs. Pressure both exact (`1/2 + 1/3 = 5/6`) and approximate (`0.1 + 1/3` remains approximate with meaningful precision). The evaluator should:

1. consume an existing P0010-compatible invocation, without inventing document context;
2. select one *already declared* P0008 evaluatorId (identify its actual catalog value before coding);
3. convert P0005 inputs through a fresh P0011 adapter instance;
4. delegate arithmetic to SymPy (do not implement arithmetic in JavaScript);
5. return a P0005 Value via P0010 success outcome;
6. reject unsupported arity/types with a P0009 Diagnostic, not a raw Python exception.

## Pressure criteria

- Exact arithmetic stays exact; no accidental `float` coercion.
- Approximate arithmetic preserves the P0011 numerical transport guarantee; do not claim more accuracy than computed.
- Distinct same-spelled SemanticIdentities never merge.
- Same inputs and options produce same mathematical result, independent of previous evaluations or tasks.
- No persistent Task Scope, document order, dependency graph, writer metadata, or backend object crosses the public boundary.
- An error produces one structured failure, not a success Value carrying an error.

## Decisions to verify before GREEN

- Which *existing* `evaluatorId` and argument signature from P0008 should this first slice use? Do not invent parallel public operation names merely for implementation convenience.
- Where should the Python evaluator entry point live relative to the existing JS P0010 transport objects? Do not assume that the JS request object can be passed unchanged through the Pyodide boundary without a specified bridge.
- Which P0009 diagnostic code/parameters apply to arity/type/backend failures? Use existing contracts, not backend exception strings.
- Whether canonical SymPy simplification for symbolic scalar arithmetic is automatically allowed by P0012, versus explicitly requested simplification.

## Explicit exclusions

FunctionValue invocation (P0013), differentiation/integration/solve (P0014), container algebra (P0015), quantities/units (P0016), statistics/regression (P0017), parser and document runtime (P0018+), and migration of the legacy Python task scope (P0038+).

## Evidence baseline entering P0012

As reported from the developer environment: 323/323 JavaScript tests, 29/29 P0011 Python tests, 29/29 in Pyodide 314.0.7 / SymPy 1.14.0. These are **P0011 baseline evidence**, not P0012 tests.

## Exit for this kickoff

The P0012 Slice 1 contract and test boundaries are agreed, with no premature evaluator implementation. RED/GREEN work begins after inspecting the concrete P0008 catalog and P0010 interface.
