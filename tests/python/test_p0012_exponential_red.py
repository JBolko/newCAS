"""P0012 Slice 14: exp tests; no trig angle semantics."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_exponential import evaluate_exp_request


def value(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def integer(i):
    return value({'op': 'integer', 'value': str(i)})


def approx(v):
    return value({'op': 'approx', 'value': v})


def symbol(scope='a', name='x'):
    return value({'op': 'symbolRef', 'identity': {
        'identityVersion': 1, 'kind': 'free-symbol', 'taskScopeId': scope,
        'name': name}})


def spec(eid='probe.scalar.exp', role='value', name='exp'):
    return {'operationSpecVersion': 1, 'operationId': name,
            'evaluatorId': eid, 'signatures': [
                {'arguments': [{'name': 'argument', 'role': role}]}]}


def req(inputs, options=None, eid='probe.scalar.exp'):
    return {'evaluationRequestVersion': 1, 'evaluatorId': eid,
            'instruction': {}, 'inputs': inputs,
            'options': {} if options is None else options}


class SelectedExponentialPressure(unittest.TestCase):
    def test_zero_exact(self):
        self.assertEqual(evaluate_exp_request(req([integer(0)]), spec())['value'], integer(1))

    def test_one_exact_e(self):
        self.assertEqual(evaluate_exp_request(req([integer(1)]), spec())['value'],
                         value({'op': 'constant', 'name': 'E'}))

    def test_symbolic_call_preserves_identity(self):
        out = evaluate_exp_request(req([symbol()]), spec())
        self.assertEqual(out['value']['data']['expr'], {'op': 'call', 'name': 'exp',
                        'args': [symbol()['data']['expr']]})

    def test_distinct_same_spelling_identity(self):
        a = evaluate_exp_request(req([symbol('scopeA')]), spec())['value']
        b = evaluate_exp_request(req([symbol('scopeB')]), spec())['value']
        self.assertNotEqual(a, b)

    def test_approx_returns_float(self):
        out = evaluate_exp_request(req([approx('0.5')]), spec())
        number = SympyValueAdapter().to_backend(out['value'])
        self.assertIsInstance(number, sp.Float)
        self.assertAlmostEqual(float(number), 1.6487212707001282, places=13)

    def test_wrong_arity(self):
        self.assertEqual(evaluate_exp_request(req([]), spec())['diagnostic']['code'], 'wrong-arity')

    def test_selected_handler_mismatch(self):
        self.assertEqual(evaluate_exp_request(req([integer(1)]), spec('probe.scalar.cos'))['diagnostic']['code'], 'unsupported-operation')

    def test_non_value_role_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_exp_request(req([integer(1)]), spec(role='symbolic'))

    def test_angle_option_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_exp_request(req([integer(1)], {'angleUnit': 'deg'}), spec())

    def test_public_operation_name_is_not_dispatch(self):
        self.assertEqual(evaluate_exp_request(req([integer(0)]), spec(name='eksponentialfunktion'))['status'], 'success')
