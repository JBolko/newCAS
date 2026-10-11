"""P0012 Slice 5 RED: selected OperationSpec owns argument arity.

The evaluator still implements only binary addition. A different signature is
NOT an invitation to implement unary or ternary addition. It must be rejected
as an unsupported selected contract before returning misleading wrong-arity
information. No public operation ID or general dispatcher is defined here.
"""
import unittest

from src.python.evaluator.scalar_operations import evaluate_scalar_request


def integer(number):
    return {"valueVersion": 1, "kind": "expression", "data": {
        "expr": {"op": "integer", "value": str(number)}}}


def spec(names=("lhs", "rhs")):
    return {"operationSpecVersion": 1, "operationId": "probe-add",
            "evaluatorId": "probe.scalar.add",
            "signatures": [{"arguments": [
                {"name": name, "role": "value"} for name in names]}],
            "purity": "pure", "diagnosticAdapterId": None}


def request(items):
    return {"evaluationRequestVersion": 1,
            "evaluatorId": "probe.scalar.add", "instruction": {},
            "inputs": items, "options": {}}


class SelectedArityPressure(unittest.TestCase):
    def test_selected_binary_signature_reports_its_expected_arity(self):
        outcome = evaluate_scalar_request(request([integer(1)]), spec())
        self.assertEqual(outcome["status"], "failure")
        self.assertEqual(outcome["diagnostic"]["code"], "wrong-arity")
        self.assertEqual(outcome["diagnostic"]["parameters"]["expected"], [2])
        self.assertEqual(outcome["diagnostic"]["parameters"]["actual"], 1)

    def test_empty_input_is_wrong_arity_for_selected_binary_signature(self):
        outcome = evaluate_scalar_request(request([]), spec())
        self.assertEqual(outcome["diagnostic"]["code"], "wrong-arity")
        self.assertEqual(outcome["diagnostic"]["parameters"]["expected"], [2])
        self.assertEqual(outcome["diagnostic"]["parameters"]["actual"], 0)

    def test_unary_selected_spec_is_contract_mismatch_not_wrong_arity(self):
        # One argument matches this *different* OperationSpec, but the chosen
        # backend implementation only supports binary addition.
        with self.assertRaisesRegex(ValueError, "signature|binary|addition"):
            evaluate_scalar_request(request([integer(2)]), spec(("only",)))

    def test_ternary_selected_spec_is_contract_mismatch_not_wrong_arity(self):
        # Do not respond "expected 2" to a request selected against a 3-arg
        # signature. The unsupported signature itself must be rejected.
        with self.assertRaisesRegex(ValueError, "signature|binary|addition"):
            evaluate_scalar_request(
                request([integer(2)]), spec(("first", "second", "third")))

    def test_binary_selected_spec_still_evaluates(self):
        outcome = evaluate_scalar_request(request([integer(2), integer(3)]), spec())
        self.assertEqual(outcome["status"], "success")
        self.assertEqual(outcome["value"], integer(5))


if __name__ == "__main__":
    unittest.main()
