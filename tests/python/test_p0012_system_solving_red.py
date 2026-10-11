"""P0012 Slice 18: system solving, coordinated solution vectors."""
import unittest
from src.python.evaluator.system_solving import evaluate_system_request
from test_p0012_solve_red import expr, integer, sym, equation


def lst(items): return {'valueVersion':1,'kind':'list','data':{'items':items}}
def add(*nodes):return expr({'op':'add','args':[x['data']['expr'] for x in nodes]})
def mul(*nodes):return expr({'op':'mul','args':[x['data']['expr'] for x in nodes]})
def neg(x):return mul(integer(-1),x)
def spec():return {'operationSpecVersion':1,'operationId':'solve-system','evaluatorId':'probe.symbolic.solve-system','signatures':[{'arguments':[{'name':'equations','role':'value'},{'name':'variables','role':'symbolic'}]}]}
def req(eqs,vars):return {'evaluationRequestVersion':1,'evaluatorId':'probe.symbolic.solve-system','instruction':{},'options':{},'inputs':[lst(eqs),lst(vars)]}
def coordinate_numbers(out):
    assert out['status']=='success',out
    assert out['value']['kind']=='set',out
    return [[int(item['data']['expr']['value']) for item in row['data']['items']] for row in out['value']['data'].get('items',[])]

class SystemPressure(unittest.TestCase):
 def test_two_by_two(self):
    x,y=sym(name='x'),sym(name='y')
    eqs=[equation(add(mul(integer(2),x),y),integer(7)),equation(add(x,neg(y)),integer(2))]
    self.assertEqual(coordinate_numbers(evaluate_system_request(req(eqs,[x,y]),spec())),[[3,1]])
 def test_three_by_three(self):
    x,y,z=sym(name='x'),sym(name='y'),sym(name='z')
    eqs=[equation(add(x,y,z),integer(6)),equation(add(mul(integer(2),x),y,neg(z)),integer(1)),equation(add(x,neg(y),z),integer(2))]
    self.assertEqual(coordinate_numbers(evaluate_system_request(req(eqs,[x,y,z]),spec())),[[1,2,3]])
 def test_order_of_coordinates_follows_variable_list(self):
    x,y=sym(name='x'),sym(name='y')
    eqs=[equation(x,integer(3)),equation(y,integer(1))]
    self.assertEqual(coordinate_numbers(evaluate_system_request(req(eqs,[y,x]),spec())),[[1,3]])
 def test_two_coordinated_solutions(self):
    x,y=sym(name='x'),sym(name='y')
    eqs=[equation(add(mul(x,x),mul(y,y)),integer(5)),equation(add(x,neg(y)),integer(1))]
    self.assertEqual(set(map(tuple,coordinate_numbers(evaluate_system_request(req(eqs,[x,y]),spec())))),{(2,1),(-1,-2)})
 def test_inconsistent_system_empty(self):
    x=sym();out=evaluate_system_request(req([equation(x,integer(1)),equation(x,integer(2))],[x]),spec())
    self.assertEqual(out['value']['data'],{'setKind':'empty'})
 def test_missing_target_rejected(self):
    x=sym();out=evaluate_system_request(req([equation(x,integer(2))],[integer(3)]),spec())
    self.assertEqual(out['diagnostic']['code'],'type-mismatch')
 def test_underdetermined_not_misrepresented(self):
    x,y=sym(name='x'),sym(name='y');out=evaluate_system_request(req([equation(add(x,y),integer(2))],[x,y]),spec())
    self.assertEqual(out['status'],'failure')
 def test_wrong_arity(self):
    request=req([],[]);request['inputs']=[]
    self.assertEqual(evaluate_system_request(request,spec())['diagnostic']['code'],'wrong-arity')
 def test_wrong_handler(self):
    s=spec();s['evaluatorId']='probe.symbolic.diff'
    self.assertEqual(evaluate_system_request(req([],[]),s)['diagnostic']['code'],'unsupported-operation')
 def test_equal_name_distinct_identity(self):
    a,b=sym('A','x'),sym('B','x')
    self.assertEqual(coordinate_numbers(evaluate_system_request(req([equation(a,integer(1)),equation(b,integer(2))],[a,b]),spec())),[[1,2]])
