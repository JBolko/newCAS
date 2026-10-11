"""P0012 Slice 15: ln and base-ten log surface semantics."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_logarithms import evaluate_ln_request, evaluate_log10_request


def value(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}

def integer(n):
    return value({'op': 'integer', 'value': str(n)})

def approx(n):
    return value({'op': 'approx', 'value': str(n)})

def symbol(scope):
    return value({'op': 'symbolRef', 'identity': {'identityVersion':1,
        'kind':'free-symbol','taskScopeId':scope,'name':'x'}})

def spec(capability, role='value', operation='log'):
    return {'operationSpecVersion':1, 'operationId':operation, 'evaluatorId':capability,
        'signatures':[{'arguments':[{'name':'argument','role':role}]}]}

def req(capability, inputs, options=None):
    return {'evaluationRequestVersion':1, 'evaluatorId':capability,
        'instruction':{}, 'inputs':inputs, 'options': {} if options is None else options}

LN='probe.scalar.ln'; LOG10='probe.scalar.log10'

class SelectedLogarithmPressure(unittest.TestCase):
    def test_ln_one(self):
        self.assertEqual(evaluate_ln_request(req(LN,[integer(1)]),spec(LN))['value'],integer(0))
    def test_ln_e(self):
        self.assertEqual(evaluate_ln_request(req(LN,[value({'op':'constant','name':'E'})]),spec(LN))['value'],integer(1))
    def test_log10_100(self):
        self.assertEqual(evaluate_log10_request(req(LOG10,[integer(100)]),spec(LOG10))['value'],integer(2))
    def test_log10_1000(self):
        self.assertEqual(evaluate_log10_request(req(LOG10,[integer(1000)]),spec(LOG10))['value'],integer(3))
    def test_ln_symbolic_identity(self):
        a=evaluate_ln_request(req(LN,[symbol('a')]),spec(LN))['value']
        b=evaluate_ln_request(req(LN,[symbol('b')]),spec(LN))['value']
        self.assertEqual(a['data']['expr']['op'],'call')
        self.assertEqual(a['data']['expr']['name'],'log')
        self.assertNotEqual(a,b)
    def test_log10_symbolic_stays_exact_and_identity(self):
        a=evaluate_log10_request(req(LOG10,[symbol('a')]),spec(LOG10))['value']
        self.assertNotEqual(a['data']['expr']['op'],'approx')
        self.assertIn('symbolRef',str(a))
        self.assertNotEqual(a,evaluate_log10_request(req(LOG10,[symbol('b')]),spec(LOG10))['value'])
    def test_approx_log10(self):
        outcome=evaluate_log10_request(req(LOG10,[approx('2.5')]),spec(LOG10))
        n=SympyValueAdapter().to_backend(outcome['value'])
        self.assertIsInstance(n,sp.Float)
        self.assertAlmostEqual(float(n),0.3979400086720376,places=13)
    def test_approx_ln(self):
        outcome=evaluate_ln_request(req(LN,[approx('2.5')]),spec(LN))
        n=SympyValueAdapter().to_backend(outcome['value'])
        self.assertIsInstance(n,sp.Float)
        self.assertAlmostEqual(float(n),0.9162907318741551,places=13)
    def test_log_zero_undefined(self):
        for handler,cap in [(evaluate_ln_request,LN),(evaluate_log10_request,LOG10)]:
            self.assertEqual(handler(req(cap,[integer(0)]),spec(cap))['diagnostic']['code'],'undefined-result')
    def test_log_negative_undefined_real(self):
        for handler,cap in [(evaluate_ln_request,LN),(evaluate_log10_request,LOG10)]:
            self.assertEqual(handler(req(cap,[integer(-2)]),spec(cap))['diagnostic']['code'],'undefined-result')
    def test_wrong_arity(self):
        self.assertEqual(evaluate_ln_request(req(LN,[]),spec(LN))['diagnostic']['code'],'wrong-arity')
    def test_mismatched_capability(self):
        self.assertEqual(evaluate_ln_request(req(LN,[integer(1)]),spec(LOG10))['diagnostic']['code'],'unsupported-operation')
    def test_symbolic_role_not_value(self):
        with self.assertRaises(ValueError): evaluate_ln_request(req(LN,[integer(1)]),spec(LN,role='symbolic'))
    def test_no_angle_options(self):
        with self.assertRaises(ValueError): evaluate_log10_request(req(LOG10,[integer(10)],{'angleUnit':'deg'}),spec(LOG10))
    def test_public_operation_id_not_dispatch(self):
        self.assertEqual(evaluate_log10_request(req(LOG10,[integer(100)]),spec(LOG10,operation='dekadisk-logaritme'))['value'],integer(2))
