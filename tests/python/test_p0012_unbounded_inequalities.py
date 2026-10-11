import unittest
from test_p0012_inequalities_red import v,num,symbol,squared,relation,spec,req
from src.python.evaluator.scalar_inequalities import evaluate_inequality_request

class UnboundedInequalityPressure(unittest.TestCase):
    def solve(self,op,lhs,rhs):
        x=symbol()
        return evaluate_inequality_request(req(relation(op,lhs(x),rhs),x),spec())

    def test_left_unbounded_open_at_endpoint(self):
        out=self.solve('lt',lambda x:x,num(7))
        self.assertEqual(out['value']['data'],{'setKind':'interval','lower':{'bound':'negative-infinity'},'upper':num(7),'lowerClosed':False,'upperClosed':False})

    def test_left_unbounded_closed_at_endpoint(self):
        out=self.solve('le',lambda x:x,num(7))
        self.assertTrue(out['value']['data']['upperClosed'])

    def test_union_closed_outer_endpoints(self):
        out=self.solve('ge',squared,num(4))
        parts=out['value']['data']['sets']
        self.assertEqual([i['kind'] for i in parts],['set','set'])
        ends={i['data']['lower'].get('bound') if 'bound' in i['data']['lower'] else i['data']['upper'].get('bound') for i in parts}
        self.assertEqual(ends,{'negative-infinity','positive-infinity'})
        self.assertTrue(all(i['data']['lowerClosed'] or i['data']['upperClosed'] for i in parts))

    def test_monotonicity_example(self):
        x=symbol(); ex=x['data']['expr']
        derivative=v({'op':'add','args':[{'op':'mul','args':[num(3)['data']['expr'],{'op':'pow','base':ex,'exponent':num(2)['data']['expr']}]},num(-3)['data']['expr']]})
        out=evaluate_inequality_request(req(relation('ge',derivative,num(0)),x),spec())
        self.assertEqual(out['status'],'success')
        self.assertEqual(out['value']['data']['setKind'],'union')

    def test_all_reals_interval(self):
        x=symbol();out=evaluate_inequality_request(req(relation('ge',squared(x),num(0)),x),spec())
        self.assertEqual(out['status'],'success')
        self.assertEqual(out['value']['data']['lower'],{'bound':'negative-infinity'})
        self.assertEqual(out['value']['data']['upper'],{'bound':'positive-infinity'})
