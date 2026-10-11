"""P0012 Slice 6 RED: separate selected public operation identity from handler capability.

These fixtures are deliberately NOT a stable addition dispatch-ID decision.
The tested function is still the selected addition handler, not a registry.
"""
import unittest
from src.python.evaluator.scalar_operations import evaluate_scalar_request


def value(n):
    return {"valueVersion": 1, "kind": "expression",
            "data": {"expr": {"op": "integer", "value": str(n)}}}


def spec(operation_id="probe-add", evaluator_id="probe.scalar.add",
         roles=("value", "value")):
    return {"operationSpecVersion": 1, "operationId": operation_id,
            "evaluatorId": evaluator_id,
            "signatures": [{"arguments": [
                {"name": "left", "role": roles[0]},
                {"name": "right", "role": roles[1]}]}],
            "purity": "pure", "diagnosticAdapterId": None}


def request(evaluator_id="probe.scalar.add"):
    return {"evaluationRequestVersion": 1, "evaluatorId": evaluator_id,
            "instruction": {}, "inputs": [value(2), value(3)], "options": {}}


class DispatchBoundaryPressure(unittest.TestCase):
    def test_existing_addition_fixture_remains_green(self):
        result = evaluate_scalar_request(request(), spec())
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["value"], value(5))

    def test_request_evaluator_id_mismatch_is_rejected(self):
        result = evaluate_scalar_request(request("wrong.evaluator"), spec())
        self.assertEqual(result["status"], "failure")

    def test_public_operation_name_is_not_a_handler_selection_key(self):
        # Once an addition handler has been selected, the *public name*
        # should not need to be spelled 'probe-add'. This is pressure on
        # the local fixture guard, NOT permission to remove handler checks.
        result = evaluate_scalar_request(request(),
                spec(operation_id="renamed-public-addition-fixture"))
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["value"], value(5))

    def test_symbolic_target_role_must_not_be_accepted_as_value_operand(self):
        # Same arity but incompatible OperationSpec argument role.
        # It is an internal selected-handler contract mismatch,
        # not a user's invalid numeric input.
        with self.assertRaisesRegex(ValueError, "role|signature|addition|value"):
            evaluate_scalar_request(request(),
                spec(roles=("value", "symbolic")))


if __name__ == "__main__":
    unittest.main()
