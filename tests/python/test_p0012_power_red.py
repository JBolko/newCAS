"""P0012 Slice 9 RED — preselected power, not a generic dispatcher.

The evaluator is deliberately absent until the RED boundary is confirmed.
"""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_power import evaluate_power_request


def expr(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def integer(n):
    return expr({'op': 'integer', 'value': str(n)})


def rational(n, d):
    return expr({'op': 'rational', 'numerator': str(n), 'denominator': str(d)})


def symbol(task, name):
    return expr({'op': 'symbolRef', 'identity': {
        'identityVersion': 1, 'kind': 'free-symbol', 'taskScopeId': task, 'name': name}})


def spec(evaluator_id='probe.scalar.power', roles=('value','value')):
    return {'operationSpecVersion': 1, 'operationId': 'probe-power',
            'evaluatorId': evaluator_id, 'signatures': [{'arguments': [
                {'name': 'base', 'role': roles[0]},
                {'name': 'exponent', 'role': roles[1]}]}],
            'purity': 'pure', 'diagnosticAdapterId': None}


def request(values, evaluator_id='probe.scalar.power'):
    return {'evaluationRequestVersion': 1, 'evaluatorId': evaluator_id,
            'instruction': {}, 'inputs': values, 'options': {}}


class SelectedPowerPressure(unittest.TestCase):
    def test_positive_integer_power_is_exact(self):
        result = evaluate_power_request(request([integer(2), integer(10)]), spec())
        self.assertEqual(result, {'evaluationOutcomeVersion': 1, 'status':'success',
                                  'value': integer(1024)})

    def test_negative_integer_exponent_gives_exact_rational(self):
        result = evaluate_power_request(request([integer(2), integer(-3)]), spec())
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['value'], rational(1, 8))

    def test_rational_exponent_stays_exact_not_float(self):
        result = evaluate_power_request(request([integer(2), rational(1,2)]), spec())
        self.assertEqual(result['status'], 'success')
        adapter = SympyValueAdapter()
        backend = adapter.to_backend(result['value'])
        self.assertEqual(backend, sp.sqrt(2))
        self.assertFalse(bool(backend.atoms(sp.Float)))

    def test_symbolic_power_preserves_symbol_identity(self):
        result = evaluate_power_request(request([symbol('task-A','a'), integer(10)]), spec())
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['value']['data']['expr']['op'], 'pow')
        self.assertEqual(result['value']['data']['expr']['base']['identity']['taskScopeId'], 'task-A')

    def test_wrong_arity_comes_from_selected_spec(self):
        result = evaluate_power_request(request([integer(2)]), spec())
        self.assertEqual(result['status'], 'failure')
        self.assertEqual(result['diagnostic']['code'], 'wrong-arity')
        self.assertEqual(result['diagnostic']['parameters']['expected'], [2])

    def test_symbolic_target_role_is_not_ordinary_value(self):
        with self.assertRaisesRegex(ValueError, 'role|signature|value'):
            evaluate_power_request(request([integer(2), integer(3)]),
                                   spec(roles=('value','symbolic')))

    def test_wrong_handler_is_not_silently_power(self):
        result = evaluate_power_request(request([integer(2), integer(3)], 'probe.scalar.add'),
                                        spec(evaluator_id='probe.scalar.add'))
        self.assertEqual(result['status'], 'failure')
        self.assertEqual(result['diagnostic']['code'], 'unsupported-operation')


if __name__ == '__main__':
    unittest.main()
