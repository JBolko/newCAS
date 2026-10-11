"""Slice 21: selected complex-domain solving, with the real default preserved."""
import unittest
from src.python.evaluator.scalar_solving import evaluate_solve_request
from tests.python.test_p0012_solve_red import integer, sym, pow_, equation, spec, req


def check(left, right, domain=None):
    x = sym()
    request = req([equation(left(x), right(x)), x])
    if domain is not None:
        request['options'] = {'domain': domain}
    return evaluate_solve_request(request, spec())


def value_node(v):
    return v['data']['expr']


class ComplexDomainSolve(unittest.TestCase):
    def test_legacy_request_remains_real(self):
        self.assertEqual(check(lambda x: pow_(x, 2), lambda x: integer(-1))['value']['data'], {'setKind': 'empty'})

    def test_explicit_real_remains_empty(self):
        self.assertEqual(check(lambda x: pow_(x, 2), lambda x: integer(-1), 'real')['value']['data'], {'setKind': 'empty'})

    def test_complex_i_roots(self):
        out = check(lambda x: pow_(x, 2), lambda x: integer(-1), 'complex')
        self.assertEqual(out['status'], 'success')
        self.assertEqual(out['value']['data']['setKind'], 'finite')
        vals = out['value']['data']['items']
        self.assertEqual(len(vals), 2)
        self.assertEqual({str(value_node(v)) for v in vals}, {"{'op': 'constant', 'name': 'I'}", "{'op': 'mul', 'args': [{'op': 'integer', 'value': '-1'}, {'op': 'constant', 'name': 'I'}]}"})

    def test_real_roots_preserved_in_complex_domain(self):
        out = check(lambda x: pow_(x, 2), lambda x: integer(4), 'complex')
        self.assertEqual({value_node(v)['value'] for v in out['value']['data']['items']}, {'-2', '2'})

    def test_complex_conjugate_pair(self):
        # (x-1)^2 = -1; avoids depending on synthetic expression expansion.
        from src.python.adapters.sympy_value_adapter import SympyValueAdapter
        x = sym()
        shifted = {'valueVersion': 1, 'kind': 'expression', 'data': {'expr':
            {'op': 'add', 'args': [x['data']['expr'], {'op': 'integer', 'value': '-1'}]}}}
        out = evaluate_solve_request({'evaluationRequestVersion': 1, 'evaluatorId': 'probe.symbolic.solve',
            'instruction': {}, 'options': {'domain':'complex'}, 'inputs': [equation(pow_(shifted, 2), integer(-1)), x]}, spec())
        self.assertEqual(out['status'], 'success')
        adapter=SympyValueAdapter()
        import sympy as sp
        self.assertEqual({str(sp.expand_complex(adapter.to_backend(v))) for v in out['value']['data']['items']}, {'1 - I', '1 + I'})

    def test_unknown_domain_is_controlled_failure(self):
        self.assertEqual(check(lambda x: x, lambda x: integer(1), 'quaternions')['diagnostic']['code'], 'unsupported-operation')

    def test_unexpected_option_rejected(self):
        x=sym(); request=req([equation(x,integer(1)),x]);request['options']={'angleUnit':'deg'}
        with self.assertRaises(ValueError): evaluate_solve_request(request,spec())
