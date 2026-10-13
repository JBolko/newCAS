import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_tangentline import evaluate_tangentline_request
from src.python.evaluator.scalar_integration import evaluate_integral_request


def v(n): return {'valueVersion':1,'kind':'expression','data':{'expr':n}}
def i(n): return v({'op':'integer','value':str(n)})
def symbol(scope='s',name='x'):return v({'op':'symbolRef','identity':{'identityVersion':1,'kind':'free-symbol','taskScopeId':scope,'name':name}})
def pow(x,n):return v({'op':'pow','base':x['data']['expr'],'exponent':i(n)['data']['expr']})
def spec(role='symbolic',eid='probe.symbolic.tangentline',name='tangentline'):
    return {'operationSpecVersion':1,'operationId':name,'evaluatorId':eid,'signatures':[{'arguments':[{'name':'expression','role':'value'},{'name':'variable','role':role},{'name':'at','role':'value'}]}]}
def req(inputs,eid='probe.symbolic.tangentline'):
    return {'evaluationRequestVersion':1,'evaluatorId':eid,'instruction':{},'inputs':inputs,'options':{}}
def tangent(*values):return evaluate_tangentline_request(req(list(values)),spec())
def backend(out):
    assert out['status']=='success',out
    return SympyValueAdapter().to_backend(out['value'])

class TangentlineTests(unittest.TestCase):
    def test_parabola(self):
        x=symbol(); r=backend(tangent(pow(x,2),x,i(2)))
        variable=next(iter(r.free_symbols));self.assertEqual(sp.simplify(r-(4*variable-4)),0)
    def test_expression_not_relation(self):
        x=symbol();self.assertEqual(tangent(pow(x,2),x,i(2))['value']['kind'],'expression')
    def test_constant_function(self):
        x=symbol();self.assertEqual(backend(tangent(i(7),x,i(2))),7)
    def test_sine_at_zero(self):
        x=symbol();expr=v({'op':'call','name':'sin','args':[x['data']['expr']]})
        out=backend(tangent(expr,x,i(0)));variable=next(iter(out.free_symbols));self.assertEqual(sp.simplify(out-variable),0)
    def test_distinct_same_spelling_symbol_not_target(self):
        xa=symbol('a');xb=symbol('b')
        out=tangent(pow(xa,2),xb,i(2));self.assertEqual(out['status'],'success')
        result=out['value'];self.assertEqual(result, pow(xa,2))
    def test_wrong_arity(self):
        self.assertEqual(evaluate_tangentline_request(req([i(3)]),spec())['diagnostic']['code'],'wrong-arity')
    def test_wrong_variable_kind(self):
        self.assertEqual(tangent(i(3),i(2),i(1))['diagnostic']['code'],'type-mismatch')
    def test_wrong_selected_handler(self):
        self.assertEqual(evaluate_tangentline_request(req([i(3),symbol(),i(2)]),spec(eid='probe.symbolic.diff'))['diagnostic']['code'],'unsupported-operation')
    def test_wrong_role(self):
        with self.assertRaises(ValueError):evaluate_tangentline_request(req([i(3),symbol(),i(2)]),spec(role='value'))
    def test_operation_name_not_dispatch(self):
        out=evaluate_tangentline_request(req([i(7),symbol(),i(0)]),spec(name='tangent_i_punkt'));self.assertEqual(out['status'],'success')

class SymbolicUpperIntegrationPressure(unittest.TestCase):
    def test_integral_from_one_to_x(self):
        x=symbol();integral_spec={'operationSpecVersion':1,'operationId':'integral','evaluatorId':'probe.symbolic.integrate','signatures':[{'arguments':[{'name':'f','role':'value'},{'name':'x','role':'symbolic'},{'name':'a','role':'value'},{'name':'b','role':'value'}]}]}
        request={'evaluationRequestVersion':1,'evaluatorId':'probe.symbolic.integrate','instruction':{},'inputs':[v({'op':'mul','args':[i(3)['data']['expr'],pow(x,2)['data']['expr']]}),x,i(1),x],'options':{}}
        result=evaluate_integral_request(request,integral_spec)
        self.assertEqual(result['status'],'success',result)
        backend_value=backend(result);variable=next(iter(backend_value.free_symbols))
        self.assertEqual(sp.simplify(backend_value+2-(variable**3+1)),0)
