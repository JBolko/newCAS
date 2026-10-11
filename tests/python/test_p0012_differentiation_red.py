"""P0012 Slice 16: first-order diff pressure (including partial derivatives)."""
import unittest
import sympy as sp
from src.python.evaluator.scalar_differentiation import evaluate_diff_request
from src.python.adapters.sympy_value_adapter import SympyValueAdapter


def val(n): return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': n}}
def num(n): return val({'op': 'integer', 'value': str(n)})
def sym(name, scope='s'):
    return val({'op':'symbolRef','identity': {'identityVersion':1,'kind':'free-symbol',
           'taskScopeId':scope,'name':name}})
def add(*a): return val({'op':'add', 'args':[v['data']['expr'] for v in a]})
def mul(*a): return val({'op':'mul', 'args':[v['data']['expr'] for v in a]})
def power(v,n): return val({'op':'pow','base':v['data']['expr'],'exponent':num(n)['data']['expr']})
def spec(eid='probe.symbolic.diff', roles=('value','symbolic'), op='diff', names=('expr','variable')):
    return {'operationSpecVersion':1,'operationId':op,'evaluatorId':eid,
            'signatures':[{'arguments':[{'name':n,'role':r} for n,r in zip(names,roles)]}]}
def req(args,eid='probe.symbolic.diff'):
    return {'evaluationRequestVersion':1, 'evaluatorId':eid,'instruction':{},'inputs':args,'options':{}}
def backend(output):
    a=SympyValueAdapter()
    return a.to_backend(output['value'])

class SelectedDifferentiationPressure(unittest.TestCase):
    def test_polynomial_exact(self):
        x=sym('x'); expr=add(power(x,3),mul(num(2),x))
        result=evaluate_diff_request(req([expr,x]),spec())
        self.assertEqual(result['status'],'success')
        self.assertEqual(result['value']['data']['expr']['op'],'add')
        self.assertIn('3', str(result['value']))

    def test_constant_derivative_zero(self):
        x=sym('x');self.assertEqual(evaluate_diff_request(req([num(7),x]),spec())['value'],num(0))

    def test_partial_derivative_x(self):
        x=sym('x');y=sym('y');expr=add(mul(x,y),power(y,2))
        self.assertEqual(evaluate_diff_request(req([expr,x]),spec())['value'],y)

    def test_partial_derivative_y(self):
        x=sym('x');y=sym('y');expr=add(mul(x,y),power(y,2))
        out=evaluate_diff_request(req([expr,y]),spec())
        self.assertEqual(out['status'],'success')
        self.assertIn('x',str(out['value']))
        self.assertIn('y',str(out['value']))

    def test_same_spelling_distinct_identity(self):
        xa=sym('x','one');xb=sym('x','two')
        self.assertEqual(evaluate_diff_request(req([power(xa,3),xb]),spec())['value'],num(0))
        self.assertNotEqual(evaluate_diff_request(req([power(xa,3),xa]),spec())['value'],num(0))

    def test_wrong_arity(self):
        self.assertEqual(evaluate_diff_request(req([num(1)]),spec())['diagnostic']['code'],'wrong-arity')

    def test_non_symbol_target(self):
        x=sym('x');out=evaluate_diff_request(req([power(x,2),add(x,num(1))]),spec())
        self.assertEqual(out['diagnostic']['code'],'type-mismatch')
        self.assertEqual(out['diagnostic']['parameters']['argument'],'variable')

    def test_non_expression_input(self):
        x=sym('x');o=evaluate_diff_request(req([{'valueVersion':1,'kind':'list','data':{}},x]),spec())
        self.assertEqual(o['diagnostic']['code'],'type-mismatch')
        self.assertEqual(o['diagnostic']['parameters']['argument'],'expr')

    def test_wrong_selected_handler(self):
        x=sym('x');self.assertEqual(evaluate_diff_request(req([x,x]),spec('probe.scalar.sin'))['diagnostic']['code'],'unsupported-operation')

    def test_contract_roles_rejected(self):
        x=sym('x')
        with self.assertRaises(ValueError): evaluate_diff_request(req([x,x]),spec(roles=('value','value')))

    def test_public_operation_name_not_dispatch(self):
        x=sym('x');self.assertEqual(evaluate_diff_request(req([x,x]),spec(op='differentier'))['value'],num(1))

    def test_nesting_using_output_value(self):
        x=sym('x');first=evaluate_diff_request(req([power(x,3),x]),spec())['value']
        second=evaluate_diff_request(req([first,x]),spec())['value']
        self.assertIn('6',str(second))
