"""P0012 Slice 17 RED: equality solving and proper public SetValue outputs."""
import unittest
from src.python.evaluator.scalar_solving import evaluate_solve_request


def expr(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def integer(n):
    return expr({'op': 'integer', 'value': str(n)})


def sym(scope='solve-scope', name='x'):
    return expr({'op': 'symbolRef', 'identity': {
        'identityVersion': 1, 'kind': 'free-symbol', 'taskScopeId': scope,
        'name': name}})


def pow_(x, n):
    return expr({'op': 'pow', 'base': x['data']['expr'],
                 'exponent': integer(n)['data']['expr']})


def equation(left, right):
    return {'valueVersion': 1, 'kind': 'relation',
            'data': {'operator': 'eq', 'left': left, 'right': right}}


def spec(role='symbolic', evaluator='probe.symbolic.solve'):
    return {'operationSpecVersion': 1, 'operationId': 'probe-solve',
            'evaluatorId': evaluator, 'signatures': [{'arguments': [
                {'name': 'equation', 'role': 'value'},
                {'name': 'variable', 'role': role}]}]}


def req(inputs, evaluator='probe.symbolic.solve'):
    return {'evaluationRequestVersion': 1, 'evaluatorId': evaluator,
            'instruction': {}, 'options': {}, 'inputs': inputs}


def roots(out):
    assert out['status'] == 'success', out
    value = out['value']
    assert value['valueVersion'] == 1 and value['kind'] == 'set', value
    assert value['data']['setKind'] in ('empty', 'finite'), value
    return value['data'].get('items', [])


class SelectedSolvePressure(unittest.TestCase):
    def test_two_exact_roots_as_finite_set(self):
        x = sym()
        out = evaluate_solve_request(req([equation(pow_(x, 2), integer(4)), x]), spec())
        self.assertEqual(set(v['data']['expr']['value'] for v in roots(out)), {'-2', '2'})

    def test_empty_solution_set(self):
        x = sym()
        out = evaluate_solve_request(req([equation(integer(0), integer(1)), x]), spec())
        self.assertEqual(out['value'], {'valueVersion': 1, 'kind': 'set',
                                        'data': {'setKind': 'empty'}})

    def test_distinct_same_named_target_not_confused(self):
        x = sym('A', 'x')
        other_x = sym('B', 'x')
        out = evaluate_solve_request(req([equation(x, integer(2)), other_x]), spec())
        # This is an identity in the target (or a condition), not the root 2.
        self.assertNotEqual(out.get('value'), {'valueVersion': 1, 'kind': 'set',
            'data': {'setKind': 'finite', 'items': [integer(2)]}})

    def test_wrong_arity(self):
        out = evaluate_solve_request(req([integer(2)]), spec())
        self.assertEqual(out['diagnostic']['code'], 'wrong-arity')

    def test_target_requires_symbol_reference(self):
        x = sym()
        out = evaluate_solve_request(req([equation(x, integer(2)), integer(3)]), spec())
        self.assertEqual(out['diagnostic']['code'], 'type-mismatch')

    def test_handler_dispatch_boundary(self):
        x = sym()
        out = evaluate_solve_request(req([equation(x, integer(2)), x]),
                                     spec(evaluator='probe.symbolic.diff'))
        self.assertEqual(out['diagnostic']['code'], 'unsupported-operation')


if __name__ == '__main__':
    unittest.main()
