"""P0012 Slice 7: a selected-operation scalar multiplication bridge.

This is NOT an operation registry or general dispatcher. The caller has
already selected the multiplication OperationSpec. Its evaluatorId is checked
against the request, but has no hardcoded global meaning here.

This temporary handler checks selected capability, role, arity, type,
and preserves P0011 scalar semantics. Generic dispatch is future work.
"""

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import validate_binary_expression_request


# Internal capability of this *already selected* multiplication handler.
# This fixture identity is NOT a final/public multiplication evaluatorId.
_MULTIPLICATION_HANDLER_CAPABILITY = "probe.scalar.multiply"


def evaluate_multiplication_request(request, operation_spec):
    """Evaluate a preselected binary multiplication operation, not dispatch."""
    failure = validate_binary_expression_request(
        request, operation_spec, _MULTIPLICATION_HANDLER_CAPABILITY, "multiplication"
    )
    if failure is not None:
        return failure

    adapter = SympyValueAdapter()
    left, right = (adapter.to_backend(value) for value in request["inputs"])
    result = adapter.from_backend(left * right)
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': result}
