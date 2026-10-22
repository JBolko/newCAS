"""S100c: explicit preselected list construction from materialized Values."""
from copy import deepcopy
from src.python.evaluator._binary_expression_contract import _failure


def evaluate_list_request(request, operation_spec):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('expected request and selected operation spec')
    if request.get('evaluationRequestVersion') != 1 or operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported request/spec version')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid operation identity')
    if request.get('evaluatorId') != 'probe.container.list' or operation_spec.get('evaluatorId') != 'probe.container.list':
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError('list construction requires empty instruction/options')
    signatures = operation_spec.get('signatures')
    if signatures != [{'arguments': [{'name': 'item', 'role': 'value', 'variadic': True}]}]:
        raise ValueError('expected selected variadic value list constructor')
    inputs = request.get('inputs')
    if not isinstance(inputs, list) or any(not isinstance(v, dict) or
            set(v) != {'valueVersion', 'kind', 'data'} or v['valueVersion'] != 1 for v in inputs):
        raise ValueError('list inputs must be materialized public Values')
    # No shape inference, conversion, sorting, expression evaluation or lookup.
    # Public Values are validated/rehydrated by the existing JS boundary.
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': {
        'valueVersion': 1, 'kind': 'list', 'data': {'items': deepcopy(inputs)}}}
