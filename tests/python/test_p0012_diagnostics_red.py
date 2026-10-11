"""P0012 Slice 3 RED: diagnostics at the selected scalar evaluator boundary.

No operation registry or new diagnostic vocabulary is introduced here.
"""
import unittest
from src.python.evaluator.scalar_operations import evaluate_scalar_request


def integer(n):
    return {'valueVersion': 1, 'kind': 'expression',
            'data': {'expr': {'op': 'integer', 'value': str(n)}}}


def selected_spec(operation_id='probe-add', evaluator_id='probe.scalar.add'):
    return {'operationSpecVersion': 1, 'operationId': operation_id,
            'evaluatorId': evaluator_id,
            'signatures': [{'arguments': [
                {'name': 'lhs', 'role': 'value'},
                {'name': 'rhs', 'role': 'value'}]}],
            'purity': 'pure', 'diagnosticAdapterId': None}


def request(inputs, evaluator_id='probe.scalar.add'):
    return {'evaluationRequestVersion': 1, 'evaluatorId': evaluator_id,
            'instruction': {}, 'inputs': inputs, 'options': {}}


def assert_failure(case, outcome, code):
    case.assertIsInstance(outcome, dict)
    case.assertEqual(set(outcome), {'evaluationOutcomeVersion', 'status', 'diagnostic'})
    case.assertEqual(outcome['evaluationOutcomeVersion'], 1)
    case.assertEqual(outcome['status'], 'failure')
    diagnostic = outcome['diagnostic']
    case.assertEqual(set(diagnostic), {'diagnosticVersion', 'code', 'parameters'})
    case.assertEqual(diagnostic['diagnosticVersion'], 1)
    case.assertEqual(diagnostic['code'], code)
    case.assertIsInstance(diagnostic['parameters'], dict)
    return diagnostic['parameters']


class ScalarDiagnosticPressure(unittest.TestCase):
    def test_too_few_inputs_returns_wrong_arity(self):
        facts = assert_failure(self,
            evaluate_scalar_request(request([integer(2)]), selected_spec()), 'wrong-arity')
        self.assertEqual(facts, {'operationId': 'probe-add', 'expected': [2], 'actual': 1})

    def test_too_many_inputs_returns_wrong_arity(self):
        facts = assert_failure(self,
            evaluate_scalar_request(request([integer(2), integer(3), integer(4)]), selected_spec()),
            'wrong-arity')
        self.assertEqual(facts['actual'], 3)
        self.assertEqual(facts['expected'], [2])

    def test_matrix_in_scalar_addition_returns_type_mismatch(self):
        matrix = {'valueVersion': 1, 'kind': 'matrix', 'data': {'rows': 1, 'cols': 1,
                   'entries': [[integer(4)]]}}
        facts = assert_failure(self,
            evaluate_scalar_request(request([integer(2), matrix]), selected_spec()),
            'type-mismatch')
        self.assertEqual(facts['operationId'], 'probe-add')
        self.assertEqual(facts['actualKind'], 'matrix')
        self.assertEqual(facts['expectedKinds'], ['expression'])
        self.assertEqual(facts['argument'], 'rhs')

    def test_unselected_handler_is_not_silently_run_as_addition(self):
        # The supplied spec selects a different evaluator capability; the
        # addition handler must not reinterpret that choice as addition.
        facts = assert_failure(self,
            evaluate_scalar_request(request([integer(2), integer(3)]), selected_spec('unknown-op', evaluator_id='wrong.handler')),
            'unsupported-operation')
        self.assertEqual(facts['operationId'], 'unknown-op')

    def test_mismatched_evaluator_identity_rejected_at_boundary(self):
        # Exact diagnostic code for transport mismatch needs a contract ruling.
        # For now require a failure Value, not an unstructured Python exception.
        outcome = evaluate_scalar_request(request([integer(2), integer(3)], 'wrong.evaluator'),
                                          selected_spec())
        self.assertEqual(outcome['status'], 'failure')
        self.assertEqual(outcome['evaluationOutcomeVersion'], 1)
        self.assertEqual(outcome['diagnostic']['diagnosticVersion'], 1)
        self.assertIsInstance(outcome['diagnostic']['code'], str)


if __name__ == '__main__':
    unittest.main()
