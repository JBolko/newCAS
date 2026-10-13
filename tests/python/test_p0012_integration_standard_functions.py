"""Permanent pressure: integration of supported elementary functions."""
import unittest
import sympy as sp
from src.python.evaluator.scalar_integration import evaluate_integral_request
from src.python.adapters.sympy_value_adapter import SympyValueAdapter


def value(node):
    return {'valueVersion':1, 'kind':'expression', 'data':{'expr':node}}


def integer(n):
    return value({'op':'integer','value':str(n)})


def constant(name):
    return value({'op':'constant','name':name})


def symbol(name='x', scope='scope1'):
    return value({'op':'symbolRef','identity':{
        'identityVersion':1,'kind':'free-symbol','taskScopeId':scope,'name':name}})


def call(name, arg):
    return value({'op':'call','name':name,'args':[arg['data']['expr']]})


def spec(arity):
    args=[{'name':'integrand','role':'value'}, {'name':'variable','role':'symbolic'}]
    if arity==4:
        args.extend([{'name':'lower','role':'value'}, {'name':'upper','role':'value'}])
    return {'operationSpecVersion':1,'operationId':'integral','evaluatorId':'probe.symbolic.integrate','signatures':[{'arguments':args}]}


def evaluate(inputs):
    request={'evaluationRequestVersion':1,'evaluatorId':'probe.symbolic.integrate',
             'instruction':{},'inputs':inputs,'options':{}}
    return evaluate_integral_request(request,spec(len(inputs)))


def backend(outcome):
    assert outcome['status']=='success',outcome
    return SympyValueAdapter().to_backend(outcome['value'])


class IntegrationFunctions(unittest.TestCase):
    def test_sine_primitive(self):
        x=symbol(); f=backend(evaluate([call('sin',x),x]))
        self.assertEqual(sp.simplify(f+sp.cos(next(iter(f.free_symbols)))),0)

    def test_exponential_primitive(self):
        x=symbol(); f=backend(evaluate([call('exp',x),x]))
        self.assertEqual(f.func,sp.exp)
        self.assertEqual(len(f.free_symbols),1)

    def test_cosine_primitive(self):
        x=symbol(); f=backend(evaluate([call('cos',x),x]))
        self.assertEqual(sp.simplify(f-sp.sin(next(iter(f.free_symbols)))),0)

    def test_natural_log_integral(self):
        x=symbol();f=backend(evaluate([call('log',x),x]))
        self.assertEqual(sp.simplify(sp.diff(f,next(iter(f.free_symbols)))-sp.log(next(iter(f.free_symbols)))),0)

    def test_definite_sine_pi(self):
        x=symbol(); f=backend(evaluate([call('sin',x),x,integer(0),constant('pi')]))
        self.assertEqual(f,sp.Integer(2))

    def test_definite_exp_zero_one(self):
        x=symbol(); f=backend(evaluate([call('exp',x),x,integer(0),integer(1)]))
        self.assertEqual(sp.simplify(f-(sp.E-1)),0)

    def test_sine_of_distinct_same_named_symbol_integrated_wrt_other(self):
        x1=symbol('x','scope1');x2=symbol('x','scope2')
        result=evaluate([call('sin',x1),x2])
        self.assertEqual(result['status'],'success')
        self.assertIn('scope1',str(result['value']))
        self.assertIn('scope2',str(result['value']))
