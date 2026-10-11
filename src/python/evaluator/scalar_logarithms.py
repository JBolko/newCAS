"""Selected natural and base-ten logarithms; backend call `log` remains natural."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._unary_value_contract import validate_unary_value_request
from src.python.evaluator._binary_expression_contract import _failure


def _evaluate_log(request, operation_spec, capability, label, base):
    failure = validate_unary_value_request(request, operation_spec, capability, label)
    if failure is not None:
        return failure
    if request.get('options') != {}:
        raise ValueError(f'{label} requires empty options')
    adapter = SympyValueAdapter()
    argument = adapter.to_backend(request['inputs'][0])
    # For known real nonpositive inputs the real logarithm is undefined.
    # Unknown symbolic domains are deliberately left symbolic.
    if argument.is_real is True and argument.is_nonpositive is True:
        return _failure('undefined-result', {'operationId': operation_spec['operationId']})
    if argument.is_number and argument.is_real is False:
        return _failure('type-mismatch', {'operationId': operation_spec['operationId'],
            'argument': operation_spec['signatures'][0]['arguments'][0]['name'],
            'expectedKinds': ['real-expression'], 'actualKind': 'complex-expression'})
    result = sp.log(argument) if base is None else sp.log(argument, sp.Integer(base))
    if result in (sp.zoo, sp.oo, -sp.oo, sp.nan):
        return _failure('undefined-result', {'operationId': operation_spec['operationId']})
    if argument.has(sp.Float) and not argument.free_symbols:
        result = sp.N(result, max(17, int(max(v._prec for v in argument.atoms(sp.Float)) * 0.30103) + 2))
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': adapter.from_backend(result)}


def evaluate_ln_request(request, operation_spec):
    """Internal `log` call means natural logarithm, not a surface `log(x)`."""
    return _evaluate_log(request, operation_spec, 'probe.scalar.ln', 'natural logarithm', None)


def evaluate_log10_request(request, operation_spec):
    """Surface `log` and `log10` may select this explicit base-ten operation."""
    return _evaluate_log(request, operation_spec, 'probe.scalar.log10', 'base-ten logarithm', 10)
