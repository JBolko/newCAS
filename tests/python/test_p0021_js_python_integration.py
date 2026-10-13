"""P0021 Slice 10: integration through actual JS compiler and actual P0012/P0011.
Run from repository root. Node emits the actual compiled selected-operation payload.
No browser/Pyodide is asserted; this uses host Python + SymPy.
"""
import json
from pathlib import Path
import subprocess
import unittest

from src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway, GatewayContractError
from src.python.evaluator.scalar_operations import evaluate_scalar_request

ROOT = Path(__file__).resolve().parents[2]


def integer(n):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': {'op': 'integer', 'value': str(n)}}}


class SelectedCrossLanguageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        completed = subprocess.run(['node', 'tests/integration/p0021_emit_selected_cases.mjs'],
                                   cwd=ROOT, check=True, text=True, capture_output=True)
        cls.cases = json.loads(completed.stdout)

    def calculate(self, case_name, handler=evaluate_scalar_request):
        case = self.cases[case_name]
        return evaluate_selected_gateway(case['envelope'], case['selection'], handler)

    def test_literal_addition_through_js_python_sympy(self):
        self.assertEqual(self.calculate('literal_2_3'), {'blockId': 'b', 'status': 'success', 'value': integer(5)})

    def test_negative_integer_is_exact_through_both_languages(self):
        self.assertEqual(self.calculate('literal_7_minus_2')['value'], integer(5))

    def test_exact_provider_identity_carries_actual_value(self):
        self.assertEqual(self.calculate('exact_provider')['value'], integer(7))

    def test_zero_provider_value_not_confused_with_missing_value(self):
        self.assertEqual(self.calculate('failing_provider_value')['value'], integer(3))

    def test_tampered_provider_identity_rejected_before_handler(self):
        invoked = []
        def handler(*args):
            invoked.append(True)
            return evaluate_scalar_request(*args)
        with self.assertRaisesRegex(GatewayContractError, 'identities differ'):
            self.calculate('tampered_identity',handler)
        self.assertEqual(invoked, [])

    def test_tampered_evaluator_identity_rejected_before_handler(self):
        invoked = []
        def handler(*args):
            invoked.append(True)
            return evaluate_scalar_request(*args)
        with self.assertRaisesRegex(GatewayContractError, 'evaluator mismatch'):
            self.calculate('tampered_evaluator',handler)
        self.assertEqual(invoked, [])

    def test_compiled_selection_attests_same_source_and_block(self):
        for case in self.cases.values():
            e, s = case['envelope'], case['selection']
            self.assertEqual((e['source'], e['blockId'], e['revision']),
                             (s['source'], s['blockId'], s['revision']))

    def test_compiler_sends_no_source_for_python_reinterpretation(self):
        for case in self.cases.values():
            request = case['selection']['evaluationRequest']
            self.assertEqual(set(request), {'evaluationRequestVersion','evaluatorId','inputs','instruction','options'})
            self.assertNotIn('source', request)
            self.assertNotIn('name', request)


if __name__ == '__main__':
    unittest.main()
