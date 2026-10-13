# P0021 Slice 8 — explicit selected-operation Python bridge

## Scope

This new **Python-only** bridge accepts the v1 portable gateway envelope from P0021 Slice 7, an **externally compiled** selection bearing the selected P0010 `evaluationRequest` and P0008 `operationSpec`, and an **already selected** P0012 handler callable. It validates protocol version, block, source, revision, task scope, provider identity attestations, and evaluatorId coherence. It forwards the already-selected request to the existing handler and converts P0010 success/failure to P0021 dispatcher outcomes. It owns no document scope, AST parsing, operation registry, or persistent SymPy objects.

Important: `providerIds` are attestations supplied by the compiler. This bridge validates their equality with the gateway bindings, **not** that the compiler correctly substituted those bindings inside the EvaluationRequest. Semantic-IR-to-P0010 compilation is **still missing** and remains a separate required contract. Selection must be produced by trusted compiler code, not by UI text or untrusted input. This bridge is not a security sandbox.

## Actual mathematical integration evidence

`test_actual_p0012_selected_addition_handler` passes the selected addition request to the **real** `src.python.evaluator.scalar_operations.evaluate_scalar_request`, which uses `SympyValueAdapter`: two exact integer ExpressionValues `2` and `3` produce a public integer ExpressionValue `5`. This was verified locally with actual P0012/P0011 source files reconstructed from the project snapshot; not with a fabricated handler. The other 13 tests cover the Python bridge and error handling.

## Not yet done

No Pyodide invocation, Worker, real OperationSpec compiler, real DocumentRuntime integration, operation dispatch, symbolic/scoped argument compilation, or cancellation. A generic Python name-to-handler lookup would violate architectural ownership. Do **not** wire source text directly into the old `CASEngine.calculate()` task scope.

## Install and test from repo root

```powershell
Expand-Archive -LiteralPath '.\P0021-slice-8-selected-python-bridge.zip' -DestinationPath '.' -Force
python -m unittest discover -s tests/python -p 'test_p0021_selected_gateway_bridge.py' -v
```

As always, follow with existing Python and JS suites. The 14 new tests add to the Python count, not JS.
