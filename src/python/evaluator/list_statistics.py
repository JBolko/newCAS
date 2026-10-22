"""Selected exact rational-list statistics; no parsing or document authority."""
import re
import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure
from src.python.evaluator._unary_value_contract import validate_unary_value_request


def _integer_string(value, positive=False):
    pattern = r'[1-9][0-9]*' if positive else r'-?(0|[1-9][0-9]*)'
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


def _evaluate_statistics(request, operation_spec, capability, statistic, *, correction=0):
    failure = validate_unary_value_request(request, operation_spec, capability,
                                           'exact statistics', expected_kind='list')
    if failure is not None and failure['diagnostic']['code'] == 'unsupported-operation':
        return failure
    argument = operation_spec['signatures'][0]['arguments'][0]
    if argument.get('variadic', False) or 'scopeOver' in argument:
        raise ValueError('statistics require exactly one ordinary value argument')
    if request.get('options') != {}:
        raise ValueError('statistics require empty options')
    if failure is not None:
        return failure
    value = request['inputs'][0]
    if (set(value) != {'valueVersion', 'kind', 'data'} or value['valueVersion'] != 1
            or not isinstance(value['data'], dict) or set(value['data']) != {'items'}
            or not isinstance(value['data']['items'], list)):
        raise ValueError('expected canonical ListValue')

    def mismatch():
        expected = ('nonempty-list-of-exact-rational-expressions' if correction == 0
                    else 'list-of-at-least-two-exact-rational-expressions')
        return _failure('type-mismatch', {'operationId': operation_spec['operationId'],
            'argument': argument['name'],
            'expectedKinds': [expected], 'actualKind': 'list'})

    items = value['data']['items']
    if len(items) <= correction:
        return mismatch()
    adapter = SympyValueAdapter()
    observations = []
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
        if node.get('op') == 'integer':
            valid = set(node) == {'op', 'value'} and _integer_string(node.get('value'))
        elif node.get('op') == 'rational':
            valid = (set(node) == {'op', 'numerator', 'denominator'}
                     and _integer_string(node.get('numerator'))
                     and _integer_string(node.get('denominator'), positive=True))
        else:
            return mismatch()
        if not valid:
            raise ValueError('expected canonical exact integer/rational strings')
        observations.append(adapter.to_backend(item))

    n = sp.Integer(len(observations))
    mean = sum(observations, sp.Integer(0)) / n
    if statistic == 'mean':
        result = mean
    else:
        variance = sum(((x - mean)**2 for x in observations), sp.Integer(0)) / (n - correction)
        result = sp.sqrt(variance) if statistic == 'standard_deviation' else variance
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': adapter.from_backend(result)}


def evaluate_mean_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.mean', 'mean')


def evaluate_variance_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.variance', 'variance')


def evaluate_standard_deviation_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.standard_deviation', 'standard_deviation')


def evaluate_sample_variance_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.sample_variance', 'variance', correction=1)


def evaluate_sample_standard_deviation_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.sample_standard_deviation', 'standard_deviation', correction=1)
