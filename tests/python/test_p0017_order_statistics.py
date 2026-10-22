import copy
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.list_statistics import evaluate_median_request, evaluate_min_request, evaluate_max_request
from test_p0017_population_statistics import expr, integer, rational, dataset, spec, request


HANDLERS = {'median': evaluate_median_request, 'min': evaluate_min_request, 'max': evaluate_max_request}


class OrderStatisticsTests(unittest.TestCase):
    def success(self, items, expected):
        for op, value in zip(HANDLERS, expected):
            with self.subTest(op=op, items=items):
                req = request(op, [dataset(items)]); selected = spec(op)
                before = copy.deepcopy((req, selected))
                out = HANDLERS[op](req, selected)
                self.assertEqual(out['status'], 'success')
                actual = SympyValueAdapter().to_backend(out['value'])
                self.assertEqual(actual, value)
                self.assertFalse(actual.has(sp.Float))
                self.assertEqual((req, selected), before)

    def test_reference_medians(self):
        self.success([integer(x) for x in [1, 3, 5]], [sp.Integer(3), sp.Integer(1), sp.Integer(5)])
        self.success([integer(x) for x in [1, 2, 3, 4]], [sp.Rational(5, 2), sp.Integer(1), sp.Integer(4)])
        self.success([integer(x) for x in [3, 1, 3, 2]], [sp.Rational(5, 2), sp.Integer(1), sp.Integer(3)])

    def test_numeric_order_not_lexical_or_input_order(self):
        self.success([integer(x) for x in [10, 2, 3]], [sp.Integer(3), sp.Integer(2), sp.Integer(10)])
        self.success([rational(2, 3), rational(1, 3), rational(1, 2)],
                     [sp.Rational(1, 2), sp.Rational(1, 3), sp.Rational(2, 3)])

    def test_exact_decimal_values(self):
        self.success([rational(1, 10), rational(1, 5)],
                     [sp.Rational(3, 20), sp.Rational(1, 10), sp.Rational(1, 5)])

    def test_negative_repeated_large_values(self):
        self.success([integer(x) for x in [-2, 4, 4]], [sp.Integer(4), sp.Integer(-2), sp.Integer(4)])
        n = 9007199254740993
        self.success([integer(n+2), integer(-n), integer(n)], [sp.Integer(n), sp.Integer(-n), sp.Integer(n+2)])

    def test_singleton(self):
        self.success([rational(-5, 7)], [sp.Rational(-5, 7)]*3)

    def test_rejected_domains(self):
        for op, handler in HANDLERS.items():
            for value in [dataset([]), dataset([integer(1)], 'vector'), dataset([dataset([])]),
                          dataset([expr({'op': 'approx', 'value': '0.1'})])]:
                with self.subTest(op=op, value=value):
                    req = request(op, [value]); before = copy.deepcopy(req)
                    self.assertEqual(handler(req, spec(op))['diagnostic'], {
                        'diagnosticVersion': 1, 'code': 'type-mismatch', 'parameters': {
                            'operationId': op, 'argument': 'data',
                            'expectedKinds': ['list' if value['kind'] == 'vector' else 'nonempty-list-of-exact-rational-expressions'],
                            'actualKind': value['kind']}})
                    self.assertEqual(req, before)

    def test_arity_and_capability(self):
        for op, handler in HANDLERS.items():
            for inputs in [[], [dataset([integer(1)])]*2]:
                self.assertEqual(handler(request(op, inputs), spec(op))['diagnostic'], {
                    'diagnosticVersion': 1, 'code': 'wrong-arity',
                    'parameters': {'operationId': op, 'expected': [1], 'actual': len(inputs)}})
            wrong = spec(op); wrong['evaluatorId'] = 'wrong'
            req = request(op, [dataset([integer(1)])]); req['evaluatorId'] = 'wrong'
            self.assertEqual(handler(req, wrong)['diagnostic']['code'], 'unsupported-operation')
