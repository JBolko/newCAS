"""P0012 selected exp handler. No angle semantics or operation registry."""

import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._unary_value_contract import validate_unary_value_request

_EXP_HANDLER_CAPABILITY = 'probe.scalar.exp'


def evaluate_exp_request(request, operation_spec):
    """Evaluate a preselected unary exp operation over a public ExpressionValue."""
    failure = validate_unary_value_request(
        request, operation_spec, _EXP_HANDLER_CAPABILITY, 'exponential'
    )
    if failure is not None:
        return failure
    if request.get('options') != {}:
        raise ValueError('exp requires empty options; no angle setting')

    adapter = SympyValueAdapter()
    argument = adapter.to_backend(request['inputs'][0])
    outcome = adapter.from_backend(sp.exp(argument))
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': outcome}
