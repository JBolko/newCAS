"""S100b: preselected exact integer-list mean; no source or document scope."""
import re
import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure
from src.python.evaluator._unary_value_contract import validate_unary_value_request

_CAPABILITY = 'probe.statistics.mean'


def evaluate_mean_request(request, operation_spec):
    failure = validate_unary_value_request(
        request, operation_spec, _CAPABILITY, 'mean', expected_kind='list')
    if failure is not None and failure['diagnostic']['code'] == 'unsupported-operation':
        return failure
    argument = operation_spec['signatures'][0]['arguments'][0]
    if argument.get('variadic', False) or 'scopeOver' in argument:
        raise ValueError('mean requires exactly one ordinary value argument')
    if request.get('options') != {}:
        raise ValueError('mean requires empty options')
    if failure is not None:
        return failure

    value = request['inputs'][0]
    if (set(value) != {'valueVersion', 'kind', 'data'} or value['valueVersion'] != 1
            or not isinstance(value['data'], dict) or set(value['data']) != {'items'}
            or not isinstance(value['data']['items'], list)):
        raise ValueError('expected canonical ListValue')

    def mismatch():
        # Existing type-mismatch producer fields; the expected kind descriptor
        # names this slice's restricted list domain, as in system_solving.py.
        return _failure('type-mismatch', {'operationId': operation_spec['operationId'],
            'argument': argument['name'],
            'expectedKinds': ['nonempty-list-of-integer-expressions'], 'actualKind': 'list'})

    items = value['data']['items']
    if not items:
        return mismatch()
    adapter = SympyValueAdapter()
    total = sp.Integer(0)
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('list items must be public Values')
        if item.get('kind') != 'expression':
            return mismatch()
        if (set(item) != {'valueVersion', 'kind', 'data'} or item['valueVersion'] != 1
                or not isinstance(item['data'], dict) or set(item['data']) != {'expr'}
                or not isinstance(item['data']['expr'], dict)):
            raise ValueError('expected canonical ExpressionValue element')
        node = item['data']['expr']
        if node.get('op') != 'integer':
            return mismatch()
        if (set(node) != {'op', 'value'} or not isinstance(node['value'], str)
                or re.fullmatch(r'-?(0|[1-9][0-9]*)', node['value']) is None):
            raise ValueError('expected canonical integer string')
        total += adapter.to_backend(item)
    result = adapter.from_backend(total / sp.Integer(len(items)))
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': result}
