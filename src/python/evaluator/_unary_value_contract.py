"""Selected unary value-contract validation. Not a generic operation dispatcher."""

from src.python.evaluator._binary_expression_contract import _failure


def validate_unary_value_request(request, operation_spec, handler_capability, handler_label,
                                 *, expected_kind='expression'):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('expected request and selected operation spec')
    if request.get('evaluationRequestVersion') != 1:
        raise ValueError('unsupported EvaluationRequest version')
    if operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported OperationSpec version')
    evaluator_id = request.get('evaluatorId')
    if not isinstance(evaluator_id, str) or not evaluator_id:
        raise ValueError('invalid evaluatorId')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid selected operationId')
    if evaluator_id != operation_spec.get('evaluatorId') or evaluator_id != handler_capability:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {}:
        raise ValueError(f'unsupported instruction in {handler_label} slice')
    inputs = request.get('inputs')
    if not isinstance(inputs, list):
        raise ValueError('inputs must be a materialized Value array')
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError(f'{handler_label} slice expects one selected signature')
    arguments = signatures[0].get('arguments') if isinstance(signatures[0], dict) else None
    if (not isinstance(arguments, list) or len(arguments) != 1
            or not isinstance(arguments[0], dict)
            or not isinstance(arguments[0].get('name'), str)
            or not arguments[0]['name']):
        raise ValueError(f'invalid selected unary {handler_label} signature')
    if arguments[0].get('role') != 'value':
        raise ValueError(f'{handler_label} handler requires a value argument role')
    if len(inputs) != 1:
        return _failure('wrong-arity', {'operationId': operation_id,
                                        'expected': [1], 'actual': len(inputs)})
    actual = inputs[0]
    if not isinstance(actual, dict):
        raise ValueError('inputs must contain public Values')
    if actual.get('kind') != expected_kind:
        return _failure('type-mismatch', {'operationId': operation_id,
                                         'argument': arguments[0]['name'],
                                         'expectedKinds': [expected_kind],
                                         'actualKind': str(actual.get('kind', 'unknown'))})
    return None
