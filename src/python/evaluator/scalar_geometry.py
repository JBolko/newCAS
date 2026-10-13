"""Selected arc-length and surface-area operations using SymPy mathematics."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure


def _geometry(request, operation_spec, capability, surface):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('expected request and selected spec')
    if request.get('evaluationRequestVersion') != 1 or operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported version')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid operationId')
    eid = request.get('evaluatorId')
    if not isinstance(eid, str) or not eid:
        raise ValueError('invalid evaluatorId')
    if eid != operation_spec.get('evaluatorId') or eid != capability:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError('geometry slice requires empty instruction/options')
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError('geometry expects one selected signature')
    arguments = signatures[0].get('arguments') if isinstance(signatures[0], dict) else None
    if (not isinstance(arguments, list) or len(arguments) != 4 or
            any(not isinstance(a, dict) or not isinstance(a.get('name'), str) or not a['name'] for a in arguments) or
            [a.get('role') for a in arguments] != ['value', 'symbolic', 'value', 'value']):
        raise ValueError('invalid geometry signature')
    inputs = request.get('inputs')
    if not isinstance(inputs, list):
        raise ValueError('inputs must be a list')
    if len(inputs) != 4:
        return _failure('wrong-arity', {'operationId': operation_id, 'expected': [4], 'actual': len(inputs)})
    for a, value in zip(arguments, inputs):
        if not isinstance(value, dict):
            raise ValueError('inputs must contain public Values')
        if value.get('kind') != 'expression':
            return _failure('type-mismatch', {'operationId': operation_id,
                  'argument': a['name'], 'expectedKinds': ['expression'],
                  'actualKind': str(value.get('kind', 'unknown'))})
    target = inputs[1].get('data', {}).get('expr')
    if not isinstance(target, dict) or target.get('op') != 'symbolRef':
        return _failure('type-mismatch', {'operationId': operation_id,
                'argument': arguments[1]['name'], 'expectedKinds': ['symbol-reference'],
                'actualKind': 'non-symbol-reference'})
    adapter = SympyValueAdapter()
    expression, variable, lower, upper = [adapter.to_backend(v) for v in inputs]
    if not isinstance(variable, sp.Symbol):
        raise ValueError('symbolic target did not resolve to symbol')
    # Bounds involving the integration variable must be treated separately;
    # do not guess a bound-variable binding convention.
    if variable in lower.free_symbols or variable in upper.free_symbols:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if lower.is_real is False or upper.is_real is False or expression.is_real is False:
        return _failure('unsupported-operation', {'operationId': operation_id})
    try:
        derivative = sp.diff(expression, variable)
        element = sp.sqrt(1 + derivative**2)
        if surface:
            element *= 2 * sp.pi * sp.Abs(expression)
        result = sp.integrate(element, (variable, lower, upper))
        if result.has(sp.Integral, sp.Piecewise, sp.Derivative, sp.nan, sp.zoo, sp.oo, -sp.oo):
            return _failure('unsupported-operation', {'operationId': operation_id})
        if result.is_real is False or result.is_nonnegative is False:
            return _failure('unsupported-operation', {'operationId': operation_id})
        output = adapter.from_backend(result)
    except (TypeError, ValueError, NotImplementedError, sp.PolynomialError):
        return _failure('unsupported-operation', {'operationId': operation_id})
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': output}


def evaluate_arclength_request(request, operation_spec):
    """Arc length for a graph of a real differentiable expression."""
    return _geometry(request, operation_spec, 'probe.symbolic.arclength', False)


def evaluate_surfacearea_request(request, operation_spec):
    """Surface area of revolution around the x-axis (multiplicity counted)."""
    return _geometry(request, operation_spec, 'probe.symbolic.surfacearea', True)
