import copy
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.list_statistics import (
    evaluate_observation_values_request, evaluate_absolute_frequencies_request,
    evaluate_relative_frequencies_request, evaluate_cumulative_absolute_frequencies_request,
    evaluate_cumulative_relative_frequencies_request)
from test_p0017_population_statistics import expr, integer, rational, dataset, spec, request

HANDLERS = dict(zip(['observation_values', 'absolute_frequencies', 'relative_frequencies',
                    'cumulative_absolute_frequencies', 'cumulative_relative_frequencies'],
                   [evaluate_observation_values_request, evaluate_absolute_frequencies_request,
                    evaluate_relative_frequencies_request, evaluate_cumulative_absolute_frequencies_request,
                    evaluate_cumulative_relative_frequencies_request]))


class FrequencyTests(unittest.TestCase):
    def success(self, items, expected):
        for op, values in zip(HANDLERS, expected):
            with self.subTest(op=op):
                req = request(op, [dataset(items)]); selected = spec(op)
                before = copy.deepcopy((req, selected))
                out = HANDLERS[op](req, selected)
                self.assertEqual(out['status'], 'success')
                self.assertEqual(out['value']['kind'], 'list')
                actual = [SympyValueAdapter().to_backend(x) for x in out['value']['data']['items']]
                self.assertEqual(actual, values)
                self.assertFalse(any(x.has(sp.Float) for x in actual))
                if op == 'relative_frequencies': self.assertEqual(sum(actual), 1)
                self.assertEqual((req, selected), before)

    def test_reference(self):
        self.success([integer(x) for x in [5, 2, 5, 3, 2, 5]],
                     [[2, 3, 5], [2, 1, 3], [sp.Rational(1, 3), sp.Rational(1, 6), sp.Rational(1, 2)],
                      [2, 3, 6], [sp.Rational(1, 3), sp.Rational(1, 2), 1]])

    def test_equal_rationals_and_decimal(self):
        self.success([rational(1, 3), rational(2, 6), rational(1, 10)],
                     [[sp.Rational(1, 10), sp.Rational(1, 3)], [1, 2], [sp.Rational(1, 3), sp.Rational(2, 3)],
                      [1, 3], [sp.Rational(1, 3), 1]])

    def test_negative_zero_large(self):
        n = 9007199254740993
        self.success([integer(x) for x in [n, 0, -n, n]],
                     [[-n, 0, n], [1, 1, 2], [sp.Rational(1, 4), sp.Rational(1, 4), sp.Rational(1, 2)],
                      [1, 2, 4], [sp.Rational(1, 4), sp.Rational(1, 2), 1]])

    def test_numeric_sorting(self):
        self.success([integer(x) for x in [10, 2, 3, 2]],
                     [[2, 3, 10], [2, 1, 1], [sp.Rational(1, 2), sp.Rational(1, 4), sp.Rational(1, 4)],
                      [2, 3, 4], [sp.Rational(1, 2), sp.Rational(3, 4), 1]])

    def test_singleton(self):
        self.success([rational(-5, 7)], [[sp.Rational(-5, 7)], [1], [1], [1], [1]])

    def test_invalid_domains(self):
        for op, handler in HANDLERS.items():
            for value in [dataset([]), dataset([integer(1)], 'vector'), dataset([dataset([])]),
                          dataset([expr({'op': 'approx', 'value': '0.1'})])]:
                req = request(op, [value]); before = copy.deepcopy(req)
                self.assertEqual(handler(req, spec(op))['diagnostic'], {
                    'diagnosticVersion': 1, 'code': 'type-mismatch', 'parameters': {
                        'operationId': op, 'argument': 'data',
                        'expectedKinds': ['list' if value['kind'] == 'vector' else 'nonempty-list-of-exact-rational-expressions'],
                        'actualKind': value['kind']}})
                self.assertEqual(req, before)

    def test_arity_capability_and_options(self):
        for op, handler in HANDLERS.items():
            for inputs in [[], [dataset([integer(1)])]*2]:
                self.assertEqual(handler(request(op, inputs), spec(op))['diagnostic'], {
                    'diagnosticVersion': 1, 'code': 'wrong-arity',
                    'parameters': {'operationId': op, 'expected': [1], 'actual': len(inputs)}})
            wrong = spec(op); wrong['evaluatorId'] = 'wrong'
            req = request(op, [dataset([integer(1)])]); req['evaluatorId'] = 'wrong'
            self.assertEqual(handler(req, wrong)['diagnostic']['code'], 'unsupported-operation')
            req = request(op, [dataset([integer(1)])]); req['options'] = {'round': 2}
            with self.assertRaises(ValueError): handler(req, spec(op))
