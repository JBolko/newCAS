"""P0012 Slice 7 RED: a selected multiplication handler, not a registry.

The temporary evaluatorId identifies only this test handler capability.
"""
import unittest
from src.python.evaluator.scalar_multiplication import evaluate_multiplication_request


def expr(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def integer(n):
    return expr({'op': 'integer', 'value': str(n)})


def rational(n, d):
    return expr({'op': 'rational', 'numerator': str(n), 'denominator': str(d)})


def symbolic(task):
    return expr({'op': 'symbolRef', 'identity': {
        'identityVersion': 1, 'kind': 'free-symbol', 'taskScopeId': task, 'name': 'x'}})


def selected_spec(roles=('value', 'value'), evaluator_id='probe.scalar.multiply'):
    return {'operationSpecVersion': 1, 'operationId': 'probe-multiply',
            'evaluatorId': evaluator_id,
            'signatures': [{'arguments': [
                {'name': 'firstFactor', 'role': roles[0]},
                {'name': 'secondFactor', 'role': roles[1]}]}],
            'purity': 'pure', 'diagnosticAdapterId': None}


def request(values, evaluator_id='probe.scalar.multiply'):
    return {'evaluationRequestVersion': 1, 'evaluatorId': evaluator_id,
            'instruction': {}, 'inputs': values, 'options': {}}


class SelectedMultiplicationPressure(unittest.TestCase):
    def test_exact_rational_multiplication(self):
        outcome = evaluate_multiplication_request(
            request([rational(2, 3), rational(3, 5)]), selected_spec())
        self.assertEqual(outcome, {
            'evaluationOutcomeVersion': 1, 'status': 'success',
            'value': rational(2, 5)})

    def test_large_integer_product_is_exact(self):
        a, b = 10**85 + 17, 10**71 + 19
        outcome = evaluate_multiplication_request(request([integer(a), integer(b)]), selected_spec())
        self.assertEqual(outcome['status'], 'success')
        self.assertEqual(outcome['value'], integer(a*b))

    def test_same_spelling_distinct_symbolic_values_stay_distinct(self):
        outcome = evaluate_multiplication_request(
            request([symbolic('task-A'), symbolic('task-B')]), selected_spec())
        self.assertEqual(outcome['status'], 'success')
        identities = []
        def collect(node):
            if isinstance(node, dict):
                if node.get('op') == 'symbolRef':
                    identities.append(node['identity']['taskScopeId'])
                for child in node.values(): collect(child)
            elif isinstance(node, list):
                for child in node: collect(child)
        collect(outcome['value'])
        self.assertCountEqual(identities, ['task-A', 'task-B'])

    def test_wrong_arity_uses_selected_signature(self):
        outcome = evaluate_multiplication_request(request([integer(3)]), selected_spec())
        self.assertEqual(outcome['status'], 'failure')
        self.assertEqual(outcome['diagnostic']['code'], 'wrong-arity')
        self.assertEqual(outcome['diagnostic']['parameters']['expected'], [2])

    def test_wrong_handler_capability_does_not_run_multiplication(self):
        outcome = evaluate_multiplication_request(
            request([integer(2), integer(3)], 'probe.scalar.add'),
            selected_spec(evaluator_id='probe.scalar.add'))
        self.assertEqual(outcome['status'], 'failure')
        self.assertEqual(outcome['diagnostic']['code'], 'unsupported-operation')

    def test_symbolic_target_role_is_not_an_ordinary_value_role(self):
        with self.assertRaisesRegex(ValueError, 'role|signature|value'):
            evaluate_multiplication_request(request([integer(2), integer(3)]),
                selected_spec(roles=('value', 'symbolic')))


if __name__ == '__main__': unittest.main()
