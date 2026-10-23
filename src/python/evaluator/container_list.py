"""S100c: explicit preselected list construction from materialized Values."""
from copy import deepcopy
import json
from src.python.adapters.statistics_value_adapter import materialize_value, encode_value, list_v2, ValueCodecError
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
    if not isinstance(inputs, list):
        raise ValueError('list inputs must be materialized public Values')
    try:
        values = [materialize_value(v) for v in inputs]
        if any(v['valueVersion'] == 2 for v in values):
            # Immutable codec objects never cross JSON directly.
            value = json.loads(encode_value(list_v2(values)))
            return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': value}
    except ValueCodecError as error:
        return _failure(error.diagnostic['code'], error.diagnostic['parameters'])
    # No shape inference, conversion, sorting, expression evaluation or lookup.
    # Both the JS ingress and Python codec validate structure, not mathematics.
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': {
        'valueVersion': 1, 'kind': 'list', 'data': {'items': deepcopy(inputs)}}}
