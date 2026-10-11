"""P0012 Slice 9: preselected binary scalar power (no dispatch registry)."""

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import validate_binary_expression_request

_POWER_HANDLER_CAPABILITY = "probe.scalar.power"  # Fixture only, not release ID.


def evaluate_power_request(request, operation_spec):
    """Compute base ** exponent; preserve exact/approx input semantics."""
    failure = validate_binary_expression_request(
        request, operation_spec, _POWER_HANDLER_CAPABILITY, "power"
    )
    if failure is not None:
        return failure

    adapter = SympyValueAdapter()
    base, exponent = (adapter.to_backend(value) for value in request["inputs"])
    result = adapter.from_backend(base ** exponent)
    return {"evaluationOutcomeVersion": 1, "status": "success", "value": result}
