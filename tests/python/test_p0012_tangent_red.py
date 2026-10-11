"""P0012 tangent pressure: poles must not leak as mathematical Values."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_trigonometry import evaluate_tangent_request
from test_p0012_trigonometry_red import value, integer, approx, symbol

def spec(eid='probe.scalar.tan', role='value', op='tan'):
    return {'operationSpecVersion':1,'operationId':op,'evaluatorId':eid,
            'signatures':[{'arguments':[{'name':'angle','role':role}]}],
            'purity':'pure','diagnosticAdapterId':None}

def req(values, unit='deg', eid='probe.scalar.tan'):
    return {'evaluationRequestVersion':1,'evaluatorId':eid,'instruction':{},
            'inputs':values,'options':{'angleUnit':unit}}

class TangentPressure(unittest.TestCase):
    def test_exact_45_deg(self):
        self.assertEqual(evaluate_tangent_request(req([integer(45)]),spec())['value'], integer(1))

    def test_exact_90_deg_is_undefined(self):
        r=evaluate_tangent_request(req([integer(90)]),spec())
        self.assertEqual(r['status'],'failure')
        self.assertEqual(r['diagnostic']['code'],'undefined-result')

    def test_exact_270_deg_is_undefined(self):
        self.assertEqual(evaluate_tangent_request(req([integer(270)]),spec())['diagnostic']['code'],'undefined-result')

    def test_exact_pi_over_two_rad_is_undefined(self):
        v=value({'op':'mul','args':[{'op':'constant','name':'pi'},
          {'op':'rational','numerator':'1','denominator':'2'}]})
        self.assertEqual(evaluate_tangent_request(req([v],'rad'),spec())['diagnostic']['code'],'undefined-result')

    def test_near_pole_finite(self):
        r=evaluate_tangent_request(req([approx('89.999')]),spec())
        self.assertEqual(r['status'],'success')
        result=SympyValueAdapter().to_backend(r['value'])
        self.assertIsInstance(result,sp.Float)
        self.assertGreater(float(result),50000)

    def test_symbolic_rad_identity(self):
        r=evaluate_tangent_request(req([symbol('scope-X','x')],'rad'),spec())
        self.assertEqual(r['status'],'success')
        n=r['value']['data']['expr']
        self.assertEqual(n['op'],'call'); self.assertEqual(n['name'],'tan')
        self.assertEqual(n['args'][0],symbol('scope-X','x')['data']['expr'])

    def test_symbolic_degree_transport(self):
        r=evaluate_tangent_request(req([symbol('scope-X','x')],'deg'),spec())
        self.assertEqual(r['status'],'success')
        n=r['value']['data']['expr']
        self.assertEqual(n['op'],'call');self.assertEqual(n['name'],'tan')

    def test_wrong_arity(self):
        self.assertEqual(evaluate_tangent_request(req([]),spec())['diagnostic']['code'],'wrong-arity')

    def test_other_evaluator_rejected(self):
        self.assertEqual(evaluate_tangent_request(req([integer(45)]),spec('probe.scalar.sin'))['diagnostic']['code'],'unsupported-operation')

    def test_wrong_role_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_tangent_request(req([integer(45)]),spec(role='symbolic'))

    def test_missing_angle_context(self):
        q=req([integer(45)]);q['options']={}
        with self.assertRaises(ValueError): evaluate_tangent_request(q,spec())

    def test_adapter_tan_roundtrip(self):
        a=SympyValueAdapter();v=symbol('scope-X','x')
        x=a.to_backend(v)
        result=a.from_backend(sp.tan(x,evaluate=False))
        self.assertEqual(result['data']['expr']['name'],'tan')
        self.assertEqual(a.to_backend(result),sp.tan(x,evaluate=False))
