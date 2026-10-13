# P0021 Slice 21 — Variable-binding boundary in source AST

The source AST compiler now accepts a `Variable` only when the document-owned
`resolveVariable(name)` callback returns a **Semantic IR** `provider-reference`
or `semantic-reference`. It does not inspect the Python scope, resolve a name
by spelling, convert references to cached Values, or infer a symbolic target.

`x := 17; x^2` must resolve to a provider reference. An unbound `x^2` may
resolve to a task-specific free-symbol identity. A future symbolic-role
compiler for `diff(x^2,x)` must create an operation-local target identity and
apply it to the expression *before* any ordinary provider resolution.

This slice intentionally does not support symbolic/scoped OperationSpec argument
roles or execute these new IR nodes in Pyodide. It also does not modify the
Peggy grammar, Python evaluator, Worker, or DocumentRuntime.

Acceptance: 12 unit tests against the real P0006/P0007/P0008 contracts;
full repository regression and end-to-end symbolic evaluation still pending.
