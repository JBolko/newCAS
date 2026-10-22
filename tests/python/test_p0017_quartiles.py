import copy
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.list_statistics import evaluate_quartiles_request, evaluate_five_number_summary_request
from test_p0017_population_statistics import expr, integer, rational, dataset, spec, request


HANDLERS = {'quartiles': evaluate_quartiles_request, 'five_number_summary': evaluate_five_number_summary_request}


class QuartileTests(unittest.TestCase):
    def success(self, items, quartiles, minimum, maximum):
        for op, expected in [('quartiles', quartiles), ('five_number_summary', [minimum, *quartiles, maximum])]:
            with self.subTest(op=op, items=items):
                req = request(op, [dataset(items)]); selected = spec(op)
                before = copy.deepcopy((req, selected))
                out = HANDLERS[op](req, selected)
                self.assertEqual(out['status'], 'success')
                self.assertEqual(set(out['value']), {'valueVersion', 'kind', 'data'})
                self.assertEqual(out['value']['valueVersion'], 1)
                self.assertEqual(out['value']['kind'], 'list')
                actual = [SympyValueAdapter().to_backend(x) for x in out['value']['data']['items']]
                self.assertEqual(actual, expected)
                self.assertTrue(all(not x.has(sp.Float) for x in actual))
                self.assertEqual((req, selected), before)

    def test_singleton_explicit_repetition(self):
        for item, expected in [(integer(0), sp.Integer(0)),
                               (rational(-5, 7), sp.Rational(-5, 7)),
                               (integer('9007199254740993'), sp.Integer('9007199254740993'))]:
            self.success([item], [expected]*3, expected, expected)

    def test_two_and_three(self):
        self.success([integer(3), integer(1)], [1, 2, 3], 1, 3)
        self.success([integer(2), integer(-3)], [-3, sp.Rational(-1, 2), 2], -3, 2)
        self.success([integer(3), integer(1), integer(2)], [1, 2, 3], 1, 3)
        self.success([integer(4), integer(-2), integer(-2)], [-2, -2, 4], -2, 4)

    def test_reference_seven_and_eight(self):
        self.success([integer(n) for n in range(1, 8)], [2, 4, 6], 1, 7)
        self.success([integer(n) for n in range(1, 9)], [sp.Rational(5, 2), sp.Rational(9, 2), sp.Rational(13, 2)], 1, 8)

    def test_excludes_center_and_preserves_repeats(self):
        self.success([integer(n) for n in [9, 1, 7, 3, 5]], [2, 5, 8], 1, 9)
        self.success([integer(n) for n in [3, 1, 3, 2]], [sp.Rational(3, 2), sp.Rational(5, 2), 3], 1, 3)

    def test_rational_decimal_negative(self):
        self.success([rational(2, 3), rational(1, 3), rational(1, 2)],
                     [sp.Rational(1, 3), sp.Rational(1, 2), sp.Rational(2, 3)], sp.Rational(1, 3), sp.Rational(2, 3))
        self.success([rational(1, 5), rational(1, 10)], [sp.Rational(1, 10), sp.Rational(3, 20), sp.Rational(1, 5)], sp.Rational(1, 10), sp.Rational(1, 5))
        self.success([integer(n) for n in [-4, -1, -3, -2]], [sp.Rational(-7, 2), sp.Rational(-5, 2), sp.Rational(-3, 2)], -4, -1)

    def test_large_integers(self):
        n = 9007199254740993
        self.success([integer(x) for x in [n+2, -n, n]], [-n, n, n+2], -n, n+2)
        self.success([integer(x) for x in [n+6, n, n+4, n+2]], [n+1, n+3, n+5], n, n+6)

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
