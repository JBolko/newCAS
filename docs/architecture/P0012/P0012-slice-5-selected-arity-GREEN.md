# P0012 Slice 5 — selected signature arity (GREEN)

**Scope:** The preselected binary addition evaluator only. No generic
OperationSpec dispatcher, operation registry or public addition ID.

The evaluator now validates the selected signature before evaluating the
number of materialized input Values. A unary or ternary signature is an
**internal selected-operation contract mismatch** (ValueError), not a
`wrong-arity` user diagnostic. For a valid binary signature, `wrong-arity`
reports `expected: [len(selected.arguments)]` and the actual input count.

There is exactly one selected signature in this slice. Overloads, variadic
arguments, signature selection and broader operation dispatch are deferred.
The underlying addition, type diagnostics and P0011 adapter are unchanged.

## Tests

    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
    python -m unittest discover -s tests/python -p "test_sympy_value_adapter.py" -v
    node --test

Expected P0012: 18/18 green. Prior confirmed baselines P0011: 29/29,
JavaScript: 323/323 (confirm again on target machine).
