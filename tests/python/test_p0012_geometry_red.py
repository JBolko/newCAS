import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_geometry import evaluate_arclength_request, evaluate_surfacearea_request


def val(n):return {'valueVersion':1,'kind':'expression','data':{'expr':n}}
def integer(n):return val({'op':'integer','value':str(n)})
def x(scope='s'):return val({'op':'symbolRef','identity':{'identityVersion':1,'kind':'free-symbol','taskScopeId':scope,'name':'x'}})
def power(a,n):return val({'op':'pow','base':a['data']['expr'],'exponent':integer(n)['data']['expr']})
def spec(name,role='symbolic',eid=None):
    eid=eid or 'probe.symbolic.'+name
    return {'operationSpecVersion':1,'operationId':name,'evaluatorId':eid,'signatures':[{'arguments':[{'name':'curve','role':'value'},{'name':'variable','role':role},{'name':'start','role':'value'},{'name':'end','role':'value'}]}]}
def req(name,inputs,eid=None):return {'evaluationRequestVersion':1,'evaluatorId':eid or 'probe.symbolic.'+name,'instruction':{},'inputs':inputs,'options':{}}
def answer(name,inputs):
    op=evaluate_arclength_request if name=='arclength' else evaluate_surfacearea_request
    result=op(req(name,inputs),spec(name))
    assert result['status']=='success',result
    return SympyValueAdapter().to_backend(result['value'])

class GeometryPressure(unittest.TestCase):
    def test_horizontal_arc(self):self.assertEqual(answer('arclength',[integer(3),x(),integer(0),integer(2)]),2)
    def test_diagonal_arc(self):self.assertEqual(answer('arclength',[x(),x(),integer(0),integer(1)]),sp.sqrt(2))
    def test_reverse_bounds_arc(self):
        # Standard oriented definite integral is negative with reversed bounds;
        # geometry does not silently pretend that is a valid arc length.
        out=evaluate_arclength_request(req('arclength',[x(),x(),integer(1),integer(0)]),spec('arclength'))
        self.assertEqual(out['status'],'failure')
    def test_constant_cylinder_area(self):self.assertEqual(answer('surfacearea',[integer(2),x(),integer(0),integer(3)]),12*sp.pi)
    def test_cone_lateral_area(self):self.assertEqual(answer('surfacearea',[x(),x(),integer(0),integer(1)]),sp.pi*sp.sqrt(2))
    def test_negative_curve_radius(self):
        minus_x=val({'op':'mul','args':[integer(-1)['data']['expr'],x()['data']['expr']]})
        self.assertEqual(answer('surfacearea',[minus_x,x(),integer(0),integer(1)]),sp.pi*sp.sqrt(2))
    def test_zero_surface(self):self.assertEqual(answer('surfacearea',[integer(0),x(),integer(0),integer(5)]),0)
    def test_arity(self):
        out=evaluate_arclength_request(req('arclength',[integer(1)]),spec('arclength'))
        self.assertEqual(out['diagnostic']['code'],'wrong-arity')
    def test_target_role(self):
        with self.assertRaises(ValueError):evaluate_arclength_request(req('arclength',[x(),x(),integer(0),integer(1)]),spec('arclength',role='value'))
    def test_target_symbol(self):
        out=evaluate_arclength_request(req('arclength',[x(),integer(1),integer(0),integer(1)]),spec('arclength'))
        self.assertEqual(out['diagnostic']['code'],'type-mismatch')
    def test_handler_boundary(self):
        out=evaluate_surfacearea_request(req('surfacearea',[x(),x(),integer(0),integer(1)]),spec('surfacearea',eid='probe.symbolic.arclength'))
        self.assertEqual(out['diagnostic']['code'],'unsupported-operation')
    def test_symbol_identity_not_by_spelling(self):
        self.assertEqual(answer('arclength',[x('a'),x('b'),integer(0),integer(1)]),1)
