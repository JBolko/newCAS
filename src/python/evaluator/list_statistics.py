"""Selected exact rational-list statistics; no parsing or document authority."""
import re
from bisect import bisect_right
import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure


def _integer_string(value, positive=False):
    pattern = r'[1-9][0-9]*' if positive else r'-?(0|[1-9][0-9]*)'
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


class _DiscreteObservations:
    """Private exact distribution of actual observations, not interval estimates."""
    def __init__(self, observations, absolute_counts=None):
        counts = {}
        weights = (sp.Integer(1) for _ in observations) if absolute_counts is None else absolute_counts
        for value, count in zip(observations, weights):
            if count:
                counts[value] = counts.get(value, sp.Integer(0)) + count
        self.values = tuple(sorted(counts))
        self.counts = tuple(counts[value] for value in self.values)
        cumulative = []
        total = sp.Integer(0)
        for count in self.counts:
            total += count
            cumulative.append(total)
        self.cumulative = tuple(cumulative)
        self.total = total

    def projection(self, statistic):
        if statistic == 'observation_values':
            return self.values
        if statistic == 'absolute_frequencies':
            return self.counts
        if statistic == 'relative_frequencies':
            return tuple(count / self.total for count in self.counts)
        if statistic == 'cumulative_absolute_frequencies':
            return self.cumulative
        if statistic == 'cumulative_relative_frequencies':
            return tuple(count / self.total for count in self.cumulative)
        raise ValueError('unknown discrete frequency projection')

    def median_slice(self, start, size):
        """Median of a virtual sorted slice, with zero-based exact integer ranks."""
        middle = start + size // 2
        upper = self.values[bisect_right(self.cumulative, middle)]
        if size % 2:
            return upper
        lower = self.values[bisect_right(self.cumulative, middle - 1)]
        return (lower + upper) / sp.Integer(2)

    def quartiles(self):
        # Explicit singleton convention approved for both public summary operations.
        if self.total == 1:
            return [self.values[0]] * 3
        half = self.total // 2
        return [self.median_slice(0, half), self.median_slice(0, self.total),
                self.median_slice(half + self.total % 2, half)]

    def mean(self):
        return sum((x * h for x, h in zip(self.values, self.counts)), sp.Integer(0)) / self.total

    def variance(self, correction):
        mean = self.mean()
        return sum((h * (x - mean)**2 for x, h in zip(self.values, self.counts)), sp.Integer(0)) / (self.total - correction)


def _list_success(adapter, values):
    return {'evaluationOutcomeVersion': 1, 'status': 'success', 'value': {
        'valueVersion': 1, 'kind': 'list',
        'data': {'items': [adapter.from_backend(x) for x in values]}}}


def _statistics_arguments(request, operation_spec, capability):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('expected request and selected operation spec')
    if request.get('evaluationRequestVersion') != 1 or operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported request/spec version')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid selected operationId')
    if request.get('evaluatorId') != capability or operation_spec.get('evaluatorId') != capability:
        return None, _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError('statistics require empty instruction/options')
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or not signatures:
        raise ValueError('expected selected statistics signatures')
    arities = []
    for signature in signatures:
        arguments = signature.get('arguments') if isinstance(signature, dict) else None
        if (not isinstance(arguments, list) or not arguments
                or any(not isinstance(a, dict) or set(a) != {'name', 'role'}
                       or a['role'] != 'value' or not isinstance(a['name'], str) or not a['name'] for a in arguments)
                or len({a['name'] for a in arguments}) != len(arguments)):
            raise ValueError('statistics require ordinary value argument signatures')
        arities.append(len(arguments))
    if arities not in ([1], [1, 2]):
        raise ValueError('unsupported statistics signatures')
    inputs = request.get('inputs')
    if not isinstance(inputs, list):
        raise ValueError('inputs must be a materialized Value array')
    if len(inputs) not in arities:
        return None, _failure('wrong-arity', {'operationId': operation_id, 'expected': arities, 'actual': len(inputs)})
    return signatures[arities.index(len(inputs))]['arguments'], None


def _exact_list(value, adapter):
    if (set(value) != {'valueVersion', 'kind', 'data'} or value['valueVersion'] != 1
            or not isinstance(value['data'], dict) or set(value['data']) != {'items'}
            or not isinstance(value['data']['items'], list)):
        raise ValueError('expected canonical ListValue')

    items = value['data']['items']
    observations = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('list items must be public Values')
        if item.get('kind') != 'expression':
            return None
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
            return None
        if not valid:
            raise ValueError('expected canonical exact integer/rational strings')
        observations.append(adapter.to_backend(item))
    return observations


def _evaluate_statistics(request, operation_spec, capability, statistic, *, correction=0):
    frequency_projection = statistic in ('observation_values', 'absolute_frequencies', 'relative_frequencies',
                                         'cumulative_absolute_frequencies', 'cumulative_relative_frequencies')
    arguments, failure = _statistics_arguments(request, operation_spec, capability)
    if failure is not None:
        return failure
    inputs = request['inputs']

    def mismatch(index, expected, actual='list'):
        return _failure('type-mismatch', {'operationId': operation_spec['operationId'],
            'argument': arguments[index]['name'], 'expectedKinds': [expected], 'actualKind': actual})

    for index, value in enumerate(inputs):
        if not isinstance(value, dict):
            raise ValueError('inputs must contain public Values')
        if value.get('kind') != 'list':
            return mismatch(index, 'list', str(value.get('kind', 'unknown')))
    adapter = SympyValueAdapter()
    observations = _exact_list(inputs[0], adapter)
    expected = ('nonempty-list-of-exact-rational-expressions' if correction == 0 or len(inputs) == 2
                else 'list-of-at-least-two-exact-rational-expressions')
    if observations is None:
        return mismatch(0, expected)
    counts = None
    if len(inputs) == 2:
        counts = _exact_list(inputs[1], adapter)
        if counts is None or any(not h.is_Integer or h < 0 for h in counts):
            return mismatch(1, 'list-of-exact-nonnegative-integers')
        if len(observations) != len(counts):
            return _failure('dimension-mismatch', {'operationId': operation_spec['operationId'],
                'expectedDimension': {'items': len(observations)}, 'actualDimension': {'items': len(counts)}})
        total = sum(counts, sp.Integer(0))
        if total == 0:
            return mismatch(1, 'absolute-frequencies-with-positive-total')
        if total <= correction:
            return mismatch(1, 'absolute-frequencies-with-total-at-least-two')
    elif len(observations) <= correction:
        return mismatch(0, expected)

    data = _DiscreteObservations(observations, counts)
    if frequency_projection:
        return _list_success(adapter, data.projection(statistic))
    if statistic in ('median', 'min', 'max', 'quartiles', 'five_number_summary'):
        if statistic in ('quartiles', 'five_number_summary'):
            summary = data.quartiles()
            if statistic == 'five_number_summary':
                summary = [data.values[0], *summary, data.values[-1]]
            return _list_success(adapter, summary)
        if statistic == 'median':
            result = data.median_slice(0, data.total)
        else:
            result = data.values[0] if statistic == 'min' else data.values[-1]
    else:
        if statistic == 'mean':
            result = data.mean()
        else:
            variance = data.variance(correction)
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


def evaluate_median_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.median', 'median')


def evaluate_min_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.min', 'min')


def evaluate_max_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.max', 'max')


def evaluate_quartiles_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.quartiles', 'quartiles')


def evaluate_five_number_summary_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.five_number_summary', 'five_number_summary')


def evaluate_observation_values_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.observation_values', 'observation_values')


def evaluate_absolute_frequencies_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.absolute_frequencies', 'absolute_frequencies')


def evaluate_relative_frequencies_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.relative_frequencies', 'relative_frequencies')


def evaluate_cumulative_absolute_frequencies_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.cumulative_absolute_frequencies', 'cumulative_absolute_frequencies')


def evaluate_cumulative_relative_frequencies_request(request, operation_spec):
    return _evaluate_statistics(request, operation_spec, 'probe.statistics.cumulative_relative_frequencies', 'cumulative_relative_frequencies')
