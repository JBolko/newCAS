"""P0012 Slice 4 RED: argument metadata must come from selected OperationSpec.

This test does not establish a public operation ID or a new dispatch registry.
"""
import copy
import unittest

from src.python.evaluator.scalar_operations import evaluate_scalar_request


def val(n):
    return {"valueVersion": 1, "kind": "expression", "data": {
        "expr": {"op": "integer", "value": str(n)}}}


def matrix():
    return {"valueVersion": 1, "kind": "matrix", "data": {
        "rows": 1, "cols": 1, "entries": [[val(2)]]}}


def selected_spec(first="lhs", second="rhs"):
    return {"operationSpecVersion": 1, "operationId": "probe-add",
            "evaluatorId": "probe.scalar.add",
            "signatures": [{"arguments": [
                {"name": first, "role": "value"},
                {"name": second, "role": "value"}]}],
            "purity": "pure", "diagnosticAdapterId": None}


def request(items):
    return {"evaluationRequestVersion": 1,
            "evaluatorId": "probe.scalar.add", "instruction": {},
            "inputs": items, "options": {}}


class SelectedSpecMetadataPressure(unittest.TestCase):
    def test_first_argument_name_in_type_diagnostic_comes_from_spec(self):
        outcome = evaluate_scalar_request(
            request([matrix(), val(3)]), selected_spec("firstOperand", "secondOperand"))
        self.assertEqual(outcome["status"], "failure")
        self.assertEqual(outcome["diagnostic"]["code"], "type-mismatch")
        self.assertEqual(outcome["diagnostic"]["parameters"]["argument"], "firstOperand")

    def test_second_argument_name_in_type_diagnostic_comes_from_spec(self):
        outcome = evaluate_scalar_request(
            request([val(3), matrix()]), selected_spec("firstOperand", "secondOperand"))
        self.assertEqual(outcome["status"], "failure")
        self.assertEqual(outcome["diagnostic"]["code"], "type-mismatch")
        self.assertEqual(outcome["diagnostic"]["parameters"]["argument"], "secondOperand")

    def test_renaming_metadata_does_not_change_addition(self):
        outcome = evaluate_scalar_request(
            request([val(2), val(3)]), selected_spec("a", "b"))
        self.assertEqual(outcome["status"], "success")
        self.assertEqual(outcome["value"], val(5))


if __name__ == "__main__":
    unittest.main()
