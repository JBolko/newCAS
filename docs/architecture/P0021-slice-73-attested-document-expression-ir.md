# P0021 Slice 73 — P0020-attested document expression → Semantic IR

## Status
GREEN for five isolated Node contract tests. This slice introduces a **compiler only** and does not switch the active batch dispatcher. Browser/Worker execution is not claimed. Assumes Slices 68–72 already installed.

## Intent
Create a single explicit lowering boundary for non-definition document expressions before eventually replacing the source-AST evaluation path. Caller supplies P0020 block entry, snapshot writers, block identity, operation specs and an AST already obtained by the existing parser. The compiler does not parse, select providers, access the document, read Values from a task scope, or execute math.

The emitted immutable Semantic IR uses existing P0021 nodes: `define`, `provider-reference`, `operation-reference`, `value`, `call`. Inner and outer function calls are ordinary nested `call(provider-reference, args)`; repeated `f(f(2))` consumes the P0020 callable binding once, without guessing a second provider. Long identifiers (`ab`) remain one lexical name; no implicit splitting.

## Closed boundaries
- Every free variable and callable must already have one unambiguous P0020-attested provider ID.
- Reject ambiguous candidates, conflicting names, missing or unused attestations and unattested assignment writers.
- Operations are selected only from supplied OperationSpecs; currently value-only binary `add`, `multiply`, `power`, with arithmetic sugar for negate, subtract and division.
- Only nonnegative safe integer source literals are lowered; unary negation uses existing operations.
- Function *definitions* and scoped/binder IR are outside this slice; the established definition compiler remains authoritative.
- The output is a **compiled plan**, not a new evaluation authority or task generation.

## Important outstanding work
Slice 74+ must connect compilation to a generic evaluator that resolves IR `provider-reference` exclusively through P0020-attested envelope Values, executes selected operations and FunctionValues using the existing Value/Worker contracts, and preserves DocumentRuntime stale commit protection. Only then can the old source-recursive evaluator be retired. Do not delete legacy adapters until their direct callers have been migrated and the normative stress-tests have adequate coverage.

No change to the P0001–P0050 frozen architectural constraints.
