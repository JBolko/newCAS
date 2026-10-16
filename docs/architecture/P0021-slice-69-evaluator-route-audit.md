# P0021 Slice 69 — evaluation-route audit and migration fence

Status: targeted GREEN (Node 22); full user Node 24 suite pending.

## Purpose

A single *semantic model* is the goal, not necessarily one JavaScript function. The selected DocumentRuntime batch currently uses two distinct justified source routes:

1. `create-source-function-definition-task-evaluator.js` — a binder/compiler for parameter identity, closure captures, and immutable FunctionValue.
2. `create-source-composed-expression-task-evaluator.js` — recursive source-attested evaluation of assignment values, variable reads, and nested calls via existing P0020 selections and OperationSpecs.

The authoritative source/order/bindings/generations/commits remain in DocumentRuntime. The cached `known` map belongs to one invocation; it is not a second persistent runtime.

## Legacy-adapter inventory (static production reachability)

| Module | From selected batch | Decision |
|---|---|---|
| `create-source-integer-assignment-task-evaluator.js` | No | Retain temporarily; audit external and test consumers before deletion |
| `create-source-literal-function-task-evaluator.js` | No | Retain: direct contract tests |
| `create-source-variable-function-task-evaluator.js` | No | Retain: direct contract tests |
| `create-source-expression-task-evaluator.js` | No | Retain temporarily; audit external consumers |
| `create-bound-function-task-evaluator.js` | No | Retain: standalone contract and browser-contract references |

Tests check the current dispatch selection, reachable module graph, absence of these historical adapters in that graph, and the explicit temporary retention of their exports. Scope is intentionally limited to **static relative ES module imports rooted at the selected batch**, not dynamic imports, external consumers, legacy CASEngine, or UI. Before deletion, search the entire repository and verify the full Node suite and any relevant real-Worker/browser tests.

## Architectural conclusion

Two routes are currently appropriate: function **definition** has binder/capture responsibilities that an ordinary value **expression** does not. Neither is licensed to create a task-scope or resolve a source name against a mutable runtime registry. Do not merge them by moving scope semantics into the evaluator.

## Next migration gates

- Confirm full regression count and branch consumers before retiring direct-test adapters.
- Shift recursive source-AST execution onto resolved Semantic IR when its required nested-call representation is available; preserve provider attestation rather than dynamically resolving names.
- Audit P0004 version lock independently and instrument real Worker/SymPy version smoke checks.
