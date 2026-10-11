"""P0012 Slice 2 RED: proposed first P0010/P0008-to-P0011 happy-path bridge.

This is an interface pressure test. The target module intentionally does not
exist yet. No public operation registry is introduced by the test.
"""
import unittest
import sympy as sp

from src.python.evaluator.scalar_operations import evaluate_scalar_request


def val(expr):
    return {"valueVersion": 1, "kind": "expression", "data": {"expr": expr}}


def integer(n):
    return {"op": "integer", "value": str(n)}


def rational(n, d):
    return {"op": "rational", "numerator": str(n), "denominator": str(d)}


def sym(scope):
    return {"op": "symbolRef", "identity": {
        "identityVersion": 1, "kind": "free-symbol", "taskScopeId": scope, "name": "x"}}


def spec(evaluator_id="probe.scalar.add"):
    # P0008 OperationSpec shape; ID is a fixture, not a normative registry entry.
    return {"operationSpecVersion": 1, "operationId": "probe-add",
            "evaluatorId": evaluator_id,
            "signatures": [{"arguments": [
                {"name": "lhs", "role": "value"},
                {"name": "rhs", "role": "value"}]}],
            "purity": "pure", "diagnosticAdapterId": None}


def request(a, b, evaluator_id="probe.scalar.add"):
    # P0010 EvaluationRequest transport shape, already semantically resolved.
    return {"evaluationRequestVersion": 1, "evaluatorId": evaluator_id,
            "instruction": {}, "inputs": [val(a), val(b)], "options": {}}


class ScalarRequestPressure(unittest.TestCase):
    def test_exact_rational_addition_returns_public_value(self):
        result = evaluate_scalar_request(request(rational(1, 2), rational(1, 3)), spec())
        self.assertEqual(result, {"evaluationOutcomeVersion": 1, "status": "success",
                                  "value": val(rational(5, 6))})

    def test_large_integer_addition_does_not_use_machine_float(self):
        huge = 10**100 + 17
        result = evaluate_scalar_request(request(integer(huge), integer(1)), spec())
        self.assertEqual(result["value"], val(integer(huge + 1)))

    def test_same_spelled_distinct_symbols_remain_distinct(self):
        result = evaluate_scalar_request(request(sym("task-A"), sym("task-B")), spec())
        self.assertEqual(result["status"], "success")
        # Examine public identities recursively, not SymPy backend identities.
        seen = []
        def collect(node):
            if isinstance(node, dict):
                if node.get("op") == "symbolRef":
                    seen.append(node["identity"]["taskScopeId"])
                for child in node.values():
                    collect(child)
            elif isinstance(node, list):
                for child in node:
                    collect(child)
        collect(result["value"])
        self.assertCountEqual(seen, ["task-A", "task-B"])

    def test_approximate_input_remains_approximate(self):
        result = evaluate_scalar_request(
            request(rational(1, 3), {"op": "approx", "value": "0.1", "precisionBits": 53}), spec())
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["value"]["data"]["expr"]["op"], "approx")
        self.assertEqual(result["value"]["data"]["expr"]["precisionBits"], 53)

    def test_selected_addition_handler_requires_its_capability(self):
        # Matching the selected request/spec alone is insufficient if this is a different handler.
        result = evaluate_scalar_request(
            request(integer(2), integer(3), "probe.other-add-id"),
            spec("probe.other-add-id"))
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["diagnostic"]["code"], "unsupported-operation")


if __name__ == "__main__":
    unittest.main()
