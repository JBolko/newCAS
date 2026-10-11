"""P0012 cosine pressure: selected unary function, no hidden angle state."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_trigonometry import evaluate_cosine_request
from test_p0012_trigonometry_red import value, integer, approx, symbol


def spec(evaluator_id='probe.scalar.cos', role='value', op='cos'):
    return {'operationSpecVersion':1,'operationId':op,'evaluatorId':evaluator_id,
            'signatures':[{'arguments':[{'name':'angle','role':role}]}],
            'purity':'pure','diagnosticAdapterId':None}


def req(inputs, unit='deg', evaluator_id='probe.scalar.cos'):
    return {'evaluationRequestVersion':1,'evaluatorId':evaluator_id,
            'instruction':{},'inputs':inputs,'options':{'angleUnit':unit}}


class SelectedCosinePressure(unittest.TestCase):
    def test_exact_zero_degrees(self):
        self.assertEqual(evaluate_cosine_request(req([integer(0)]),spec())['value'],integer(1))

    def test_exact_sixty_degrees(self):
        self.assertEqual(evaluate_cosine_request(req([integer(60)]),spec())['value'],
            value({'op':'rational','numerator':'1','denominator':'2'}))

    def test_exact_ninety_degrees(self):
        self.assertEqual(evaluate_cosine_request(req([integer(90)]),spec())['value'],integer(0))

    def test_one_radian_remains_exact_symbolic(self):
        outcome=evaluate_cosine_request(req([integer(1)],'rad'),spec())
        expr=SympyValueAdapter().to_backend(outcome['value'])
        self.assertEqual(expr,sp.cos(1))
        self.assertFalse(expr.atoms(sp.Float))

    def test_symbolic_radians_retain_identity(self):
        outcome=evaluate_cosine_request(req([symbol('scope1','x')],'rad'),spec())
        self.assertEqual(outcome['value']['data']['expr']['op'],'call')
        self.assertEqual(outcome['value']['data']['expr']['name'],'cos')
        self.assertEqual(outcome['value']['data']['expr']['args'][0],symbol('scope1','x')['data']['expr'])

    def test_approximate_argument_remains_approximate(self):
        outcome=evaluate_cosine_request(req([approx('0.5')],'rad'),spec())
        x=SympyValueAdapter().to_backend(outcome['value'])
        self.assertIsInstance(x,sp.Float)
        self.assertAlmostEqual(float(x),0.8775825618903728,places=13)

    def test_wrong_arity(self):
        outcome=evaluate_cosine_request(req([]),spec())
        self.assertEqual(outcome['diagnostic']['code'],'wrong-arity')
        self.assertEqual(outcome['diagnostic']['parameters']['expected'],[1])

    def test_mismatched_selected_evaluator(self):
        outcome=evaluate_cosine_request(req([integer(30)]),spec('probe.scalar.sin'))
        self.assertEqual(outcome['diagnostic']['code'],'unsupported-operation')

    def test_symbolic_role_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_cosine_request(req([symbol()],'rad'),spec(role='symbolic'))

    def test_missing_angle_context_rejected(self):
        request=req([integer(30)]); request['options']={}
        with self.assertRaises(ValueError): evaluate_cosine_request(request,spec())

    def test_public_operation_name_not_dispatch_key(self):
        self.assertEqual(evaluate_cosine_request(req([integer(60)]),spec(op='localized-kosinus'))['status'],'success')
