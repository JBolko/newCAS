# P0021 Slice 51 — DocumentRuntime function writer → call, one batch

**Status:** locally GREEN (5 new tests; 31 targeted regression tests). Full Node 24 suite requires user verification.

## Verified path

The **existing** DocumentRuntime derives P0020/P0021 semantics, prepares the ordered batch, dispatches through `evaluateAndCommitSemanticTask()`, and writes the outcomes to its existing `block.calculation` slots. Slice 50's source-attested definition evaluator produces the `FunctionValue`; Slice 43's source-attested literal call consumes that same run's successful provider outcome. The arithmetic callback is a selected backend-neutral test evaluator, not a live Pyodide Worker in this slice.

The `createRuntimeFunctionBatchEvaluator` compositor holds only **transient successful outcomes within one evaluation invocation** to bridge the existing sequential P0021 dispatcher to the existing `createValueEvaluator` provider reader. It does not change source, own revisions, persist a document registry, or provide cross-batch cached results. The DocumentRuntime remains the only authority to commit outcomes. No old CASEngine call is made.

## Cases

- `f(x):=x^2+3x; f(10)` → 130; `FunctionValue` originates from runtime source, not a test fixture.
- Insert `f(x):=2x+1` between calls: earlier `f(10)=130`, later `f(3)=7`.
- Remove the later definition: `f(3)=18` using the earlier writer.
- Remove the first writer: an earlier call remains invalid and the later call evaluates to 7; no forward fallback.
- Unsupported literal forms fail closed.

## Remaining work

The compositor currently selects only capture-free source `FunctionDefinition` and one-integer-literal `FunctionCall`. Variable-provider arguments, captures, expression definitions, blocked parse/call diagnostics, automatic dirty-only incremental scheduling and live Worker execution require further integration. A complete document source including these forms is **not yet** supported end-to-end. Do not replace the normative P0005/P0006/P0007/P0008 and DocumentRuntime ownership rules with special cases.
