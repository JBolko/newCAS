import unittest
from src.python.evaluator.scalar_inequalities import evaluate_inequality_request

def v(node): return {'valueVersion':1,'kind':'expression','data':{'expr':node}}
def num(n): return v({'op':'integer','value':str(n)})
def symbol(scope='scope'):
    return v({'op':'symbolRef','identity':{'identityVersion':1,'kind':'free-symbol','taskScopeId':scope,'name':'x'}})
def squared(x): return v({'op':'pow','base':x['data']['expr'],'exponent':num(2)['data']['expr']})
def relation(op,a,b): return {'valueVersion':1,'kind':'relation','data':{'operator':op,'left':a,'right':b}}
def spec(eid='probe.symbolic.solve-inequality',role='symbolic'):
    return {'operationSpecVersion':1,'operationId':'inequality','evaluatorId':eid,'signatures':[{'arguments':[{'name':'inequality','role':'value'},{'name':'variable','role':role}]}]}
def req(a,b,eid='probe.symbolic.solve-inequality'):
    return {'evaluationRequestVersion':1,'evaluatorId':eid,'inputs':[a,b],'instruction':{},'options':{}}
class InequalityPressure(unittest.TestCase):
    def test_open_interval(self):
        x=symbol(); out=evaluate_inequality_request(req(relation('lt',squared(x),num(4)),x),spec())
        self.assertEqual(out['value']['data'],{'setKind':'interval','lower':num(-2),'upper':num(2),'lowerClosed':False,'upperClosed':False})
    def test_closed_interval(self):
        x=symbol(); out=evaluate_inequality_request(req(relation('le',squared(x),num(4)),x),spec())
        self.assertEqual(out['value']['data'],{'setKind':'interval','lower':num(-2),'upper':num(2),'lowerClosed':True,'upperClosed':True})
    def test_empty_set(self):
        x=symbol(); out=evaluate_inequality_request(req(relation('lt',squared(x),num(0)),x),spec())
        self.assertEqual(out['value']['data'],{'setKind':'empty'})
    def test_unbounded_interval_not_misrepresented(self):
        x=symbol(); out=evaluate_inequality_request(req(relation('gt',x,num(3)),x),spec())
        self.assertEqual(out['status'],'success')
        self.assertEqual(out['value']['data']['lower'],num(3))
        self.assertEqual(out['value']['data']['upper'],{'bound':'positive-infinity'})
        self.assertFalse(out['value']['data']['lowerClosed'])
    def test_union_not_misrepresented(self):
        x=symbol(); out=evaluate_inequality_request(req(relation('ge',squared(x),num(4)),x),spec())
        self.assertEqual(out['status'],'success')
        self.assertEqual(out['value']['data']['setKind'],'union')
        self.assertEqual(len(out['value']['data']['sets']),2)
    def test_same_spelling_identity_is_not_swapped(self):
        x=symbol('A'); other=symbol('B'); out=evaluate_inequality_request(req(relation('lt',squared(x),num(4)),other),spec())
        self.assertNotEqual(out['status'],'success')
    def test_arity(self):
        x=symbol(); q=req(relation('lt',x,num(4)),x);q['inputs']=[x]
        self.assertEqual(evaluate_inequality_request(q,spec())['diagnostic']['code'],'wrong-arity')
    def test_wrong_handler(self):
        x=symbol();out=evaluate_inequality_request(req(relation('lt',x,num(3)),x),spec('probe.symbolic.solve'))
        self.assertEqual(out['diagnostic']['code'],'unsupported-operation')
    def test_role_contract(self):
        x=symbol()
        with self.assertRaises(ValueError): evaluate_inequality_request(req(relation('lt',x,num(3)),x),spec(role='value'))
