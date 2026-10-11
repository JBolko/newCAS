"""P0012 Slice 16: preselected first-order differentiation, no dispatcher."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure

_DIFF_CAPABILITY = 'probe.symbolic.diff'


def evaluate_diff_request(request, operation_spec):
    """Differentiate a Value expression with respect to a symbolRef Value.

    Both inputs are resolved Values; the second is a symbolic *target*, not
    a numeric value or a new symbol inferred from display spelling.
    """
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('request and selected operation spec required')
    if request.get('evaluationRequestVersion') != 1 or operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported contract version')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid operationId')
    eid = request.get('evaluatorId')
    if not isinstance(eid, str) or not eid:
        raise ValueError('invalid evaluatorId')
    if eid != operation_spec.get('evaluatorId') or eid != _DIFF_CAPABILITY:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError('first-order diff requires empty instruction and options')
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError('diff needs one selected signature')
    signature = signatures[0]
    arguments = signature.get('arguments') if isinstance(signature, dict) else None
    if (not isinstance(arguments, list) or len(arguments) != 2
            or any(not isinstance(a, dict) or not isinstance(a.get('name'), str)
                   or not a['name'] for a in arguments)):
        raise ValueError('invalid selected diff signature')
    if [a.get('role') for a in arguments] != ['value', 'symbolic']:
        raise ValueError('diff requires roles value, symbolic')
    inputs = request.get('inputs')
    if not isinstance(inputs, list):
        raise ValueError('inputs must be a Value array')
    if len(inputs) != 2:
        return _failure('wrong-arity', {'operationId': operation_id,
                                        'expected': [2], 'actual': len(inputs)})
    expression, target = inputs
    for spec_arg, v in zip(arguments, inputs):
        if not isinstance(v, dict):
            raise ValueError('inputs must contain public Values')
        if v.get('kind') != 'expression':
            return _failure('type-mismatch', {'operationId': operation_id,
                 'argument': spec_arg['name'], 'expectedKinds': ['expression'],
                 'actualKind': str(v.get('kind', 'unknown'))})
    # A symbolic-target role requires the resolved symbol itself, not a
    # general symbolic expression and not a name to be looked up here.
    target_node = target.get('data', {}).get('expr') if isinstance(target.get('data'), dict) else None
    if not isinstance(target_node, dict) or target_node.get('op') != 'symbolRef':
        return _failure('type-mismatch', {'operationId': operation_id,
            'argument': arguments[1]['name'], 'expectedKinds': ['symbol-reference'],
            'actualKind': 'non-symbol-reference'})
    adapter = SympyValueAdapter()
    expr_backend = adapter.to_backend(expression)
    target_backend = adapter.to_backend(target)
    if not isinstance(target_backend, sp.Symbol):
        raise ValueError('internal symbolic-target translation did not produce a Symbol')
    result = sp.diff(expr_backend, target_backend)
    return {'evaluationOutcomeVersion': 1, 'status': 'success',
            'value': adapter.from_backend(result)}
