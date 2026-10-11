"""P0012: selected integration for one-variable ExpressionValues.

Indefinite integration returns one primitive, not the full +C family.
"""
import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure

_INTEGRAL_CAPABILITY = "probe.symbolic.integrate"


def evaluate_integral_request(request, operation_spec):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError("request and spec must be objects")
    if request.get("evaluationRequestVersion") != 1 or operation_spec.get("operationSpecVersion") != 1:
        raise ValueError("invalid contract version")
    operation_id = operation_spec.get("operationId")
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError("invalid operationId")
    eid = request.get("evaluatorId")
    if not isinstance(eid, str) or not eid:
        raise ValueError("invalid evaluatorId")
    if eid != operation_spec.get("evaluatorId") or eid != _INTEGRAL_CAPABILITY:
        return _failure("unsupported-operation", {"operationId": operation_id})
    if request.get("instruction") != {} or request.get("options") != {}:
        raise ValueError("this integral slice requires empty instruction/options")

    signatures = operation_spec.get("signatures")
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError("integral expects one selected signature")
    args = signatures[0].get("arguments") if isinstance(signatures[0], dict) else None
    if not isinstance(args, list) or len(args) not in (2, 4):
        raise ValueError("integral signature must have two or four arguments")
    roles = ["value", "symbolic"] + (["value", "value"] if len(args) == 4 else [])
    if any(not isinstance(a, dict) or not isinstance(a.get("name"), str)
           or not a["name"] or a.get("role") != role for a, role in zip(args, roles)):
        raise ValueError("invalid integral signature roles/names")

    values = request.get("inputs")
    if not isinstance(values, list):
        raise ValueError("inputs must be a Value array")
    if len(values) != len(args):
        return _failure("wrong-arity", {"operationId": operation_id,
                                      "expected": [len(args)], "actual": len(values)})
    for argument, val in zip(args, values):
        if not isinstance(val, dict):
            raise ValueError("inputs must contain public Values")
        if val.get("kind") != "expression":
            return _failure("type-mismatch", {"operationId": operation_id,
                "argument": argument["name"], "expectedKinds": ["expression"],
                "actualKind": str(val.get("kind", "unknown"))})
    target_node = values[1].get("data", {}).get("expr")
    if not isinstance(target_node, dict) or target_node.get("op") != "symbolRef":
        return _failure("type-mismatch", {"operationId": operation_id,
            "argument": args[1]["name"], "expectedKinds": ["symbol-reference"],
            "actualKind": "non-symbol-reference"})

    adapter = SympyValueAdapter()
    expr, symbol = [adapter.to_backend(v) for v in values[:2]]
    if not isinstance(symbol, sp.Symbol):
        raise ValueError("symbolic target did not become a symbol")
    if len(values) == 2:
        result = sp.integrate(expr, symbol)
    else:
        lower, upper = [adapter.to_backend(v) for v in values[2:]]
        result = sp.integrate(expr, (symbol, lower, upper))
    # Unevaluated Integral has no current public P0011 representation.
    if result.has(sp.Integral) or result.has(sp.Piecewise) or result.has(sp.nan, sp.zoo, sp.oo, -sp.oo):
        return _failure("unsupported-operation", {"operationId": operation_id})
    try:
        value = adapter.from_backend(result)
    except (TypeError, ValueError, NotImplementedError):
        return _failure("unsupported-operation", {"operationId": operation_id})
    return {"evaluationOutcomeVersion": 1, "status": "success", "value": value}
