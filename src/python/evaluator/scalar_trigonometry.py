"""Selected trigonometric functions with explicit angle semantics."""

import sympy as sp

from src.python.evaluator._binary_expression_contract import _failure
from src.python.evaluator._trigonometric_argument import prepare_trigonometric_argument

_SINE_HANDLER_CAPABILITY = 'probe.scalar.sin'
_COSINE_HANDLER_CAPABILITY = 'probe.scalar.cos'
_TANGENT_HANDLER_CAPABILITY = 'probe.scalar.tan'


def evaluate_sine_request(request, operation_spec):
    failure, adapter, radians = prepare_trigonometric_argument(
        request, operation_spec, _SINE_HANDLER_CAPABILITY, 'sine'
    )
    if failure is not None:
        return failure
    return {'evaluationOutcomeVersion': 1, 'status': 'success',
            'value': adapter.from_backend(sp.sin(radians))}


def evaluate_cosine_request(request, operation_spec):
    failure, adapter, radians = prepare_trigonometric_argument(
        request, operation_spec, _COSINE_HANDLER_CAPABILITY, 'cosine'
    )
    if failure is not None:
        return failure
    return {'evaluationOutcomeVersion': 1, 'status': 'success',
            'value': adapter.from_backend(sp.cos(radians))}


def evaluate_tangent_request(request, operation_spec):
    failure, adapter, radians = prepare_trigonometric_argument(
        request, operation_spec, _TANGENT_HANDLER_CAPABILITY, 'tangent'
    )
    if failure is not None:
        return failure

    answer = sp.tan(radians)
    # Preserve exact symbolic values; explicitly compute finite approximate angles.
    if radians.has(sp.Float) and not radians.free_symbols:
        answer = sp.N(answer, max(17, int(max(
            v._prec for v in radians.atoms(sp.Float)) * 0.30103) + 2))
    # An exact pole is undefined; closeness to a pole is not a reason to reject.
    if answer in (sp.zoo, sp.oo, -sp.oo, sp.nan) or answer.is_finite is False:
        return _failure('undefined-result',
                        {'operationId': operation_spec['operationId']})
    return {'evaluationOutcomeVersion': 1, 'status': 'success',
            'value': adapter.from_backend(answer)}
