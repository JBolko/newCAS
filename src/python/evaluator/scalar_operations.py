"""P0012 Slice 2: a selected-operation scalar addition bridge.

This is NOT an operation registry or general dispatcher. The caller has
already selected the addition OperationSpec. Its evaluatorId is checked
against the request, but has no hardcoded global meaning here.

P0009 diagnostics are supported for selected failure cases; full dispatcher is future work.
"""

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import validate_binary_expression_request


# Internal capability of this *already selected* addition handler.
# This fixture identity is NOT a final/public addition evaluatorId.
_ADDITION_HANDLER_CAPABILITY = "probe.scalar.add"


def evaluate_scalar_request(request, operation_spec):
    """Evaluate a preselected binary addition operation, not dispatch."""
    failure = validate_binary_expression_request(
        request, operation_spec, _ADDITION_HANDLER_CAPABILITY, "addition"
    )
    if failure is not None:
        return failure

    adapter = SympyValueAdapter()
    left, right = (adapter.to_backend(value) for value in request["inputs"])
    result = adapter.from_backend(left + right)
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': result}
