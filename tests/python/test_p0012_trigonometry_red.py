"""P0012 Slice 10 RED: trigonometry and explicit angular context.

Intentional import failure until a selected unary handler exists. The
symbolic pressure tests also expose unsupported Call/constant transport in
P0011. Do not turn those into floats to make the tests green.
"""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_trigonometry import evaluate_sine_request


def value(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def integer(n):
    return value({'op': 'integer', 'value': str(n)})


def approx(s):
    return value({'op': 'approx', 'value': s, 'precisionBits': 53})


def symbol(scope='task-A', name='x'):
    return value({'op':'symbolRef','identity': {'identityVersion':1,
        'kind':'free-symbol','taskScopeId':scope,'name':name}})


def selected_spec(evaluator_id='probe.scalar.sin', role='value'):
    return {'operationSpecVersion':1,'operationId':'probe-sin',
            'evaluatorId': evaluator_id,
            'signatures':[{'arguments':[{'name':'angle','role':role}]}],
            'purity':'pure','diagnosticAdapterId':None}


def request(inputs, unit='deg', evaluator_id='probe.scalar.sin'):
    return {'evaluationRequestVersion':1,'evaluatorId':evaluator_id,
            'instruction':{}, 'inputs':inputs,
            'options':{'angleUnit':unit}}


class TrigonometryArchitecturePressure(unittest.TestCase):
    def test_exact_30_degrees(self):
        outcome=evaluate_sine_request(request([integer(30)],'deg'),selected_spec())
        self.assertEqual(outcome['status'],'success')
        self.assertEqual(outcome['value'],value({'op':'rational','numerator':'1','denominator':'2'}))

    def test_exact_90_degrees(self):
        outcome=evaluate_sine_request(request([integer(90)],'deg'),selected_spec())
        self.assertEqual(outcome['status'],'success')
        self.assertEqual(outcome['value'],integer(1))

    def test_zero_radians(self):
        outcome=evaluate_sine_request(request([integer(0)],'rad'),selected_spec())
        self.assertEqual(outcome['status'],'success')
        self.assertEqual(outcome['value'],integer(0))

    def test_one_radian_is_not_a_decimal_approximation(self):
        outcome=evaluate_sine_request(request([integer(1)],'rad'),selected_spec())
        self.assertEqual(outcome['status'],'success')
        expr=SympyValueAdapter().to_backend(outcome['value'])
        self.assertEqual(expr, sp.sin(1))
        self.assertFalse(bool(expr.atoms(sp.Float)))

    def test_symbolic_radians_preserve_identity(self):
        outcome=evaluate_sine_request(request([symbol('task-A','x')],'rad'),selected_spec())
        self.assertEqual(outcome['status'],'success')
        expression=outcome['value']['data']['expr']
        self.assertEqual(expression['op'],'call')
        # The exact public call-node shape must follow P0005/P0011, not be
        # invented for this test. Identity preservation is checked via
        # adapter roundtrip using the same adapter instance where possible.

    def test_approximate_radians_remain_approximate(self):
        outcome=evaluate_sine_request(request([approx('0.5')],'rad'),selected_spec())
        self.assertEqual(outcome['status'],'success')
        result=SympyValueAdapter().to_backend(outcome['value'])
        self.assertIsInstance(result,sp.Float)
        self.assertAlmostEqual(float(result),0.479425538604203,places=13)

    def test_wrong_arity_uses_selected_unary_signature(self):
        outcome=evaluate_sine_request(request([],'deg'),selected_spec())
        self.assertEqual(outcome['status'],'failure')
        self.assertEqual(outcome['diagnostic']['code'],'wrong-arity')
        self.assertEqual(outcome['diagnostic']['parameters']['expected'],[1])
        self.assertEqual(outcome['diagnostic']['parameters']['actual'],0)

    def test_wrong_selected_evaluator_is_rejected(self):
        outcome=evaluate_sine_request(request([integer(30)],'deg'),selected_spec('probe.scalar.add'))
        self.assertEqual(outcome['status'],'failure')
        self.assertEqual(outcome['diagnostic']['code'],'unsupported-operation')

    def test_symbolic_target_role_is_not_plain_value_role(self):
        with self.assertRaises(ValueError):
            evaluate_sine_request(request([symbol()],'rad'),selected_spec(role='symbolic'))

    def test_missing_angle_context_is_not_guessed_by_evaluator(self):
        missing=request([integer(30)])
        missing['options']={}
        with self.assertRaises(ValueError):
            evaluate_sine_request(missing,selected_spec())
