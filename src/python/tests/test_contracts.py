import json
from core.executor import run_in_task, get_task_state_json
from cas_math.registry import build_context


def test_registered_distribution_functions_are_callable():
    ctx, _ = build_context()
    for name in ("binompdf", "binomcdf", "poissonpdf", "poissoncdf", "normpdf", "normcdf", "invnorm"):
        assert name in ctx
        assert callable(ctx[name])


def test_distribution_result_contract():
    cases = {
        "binompdf(2, 10, 0.5)": "scalar",
        "normcdf(1.96, 0, 1)": "scalar",
        "invnorm(0.84, 0, 1)": "scalar",
        "poissonpdf(3, 2)": "scalar",
    }
    for expr, expected_type in cases.items():
        result = json.loads(run_in_task("contract-distributions", expr))
        assert result["type"] == expected_type
        assert "latex" in result
        assert "decimal" in result


def test_hypothesis_test_is_structured():
    result = json.loads(run_in_task("contract-hypothesis", "binomtest(7, 10, 0.5)"))
    assert result["type"] == "hypothesis_test"
    for key in ("p_value", "alpha", "conclusion"):
        assert key in result

def test_decimal_field_is_always_a_string():
    expressions = (
        "2 + 3",
        "x**2 + 1",
        "[1, 2, 3]",
        "sqrt(-9)",
    )
    for expr in expressions:
        result = json.loads(run_in_task("contract-decimal", expr))
        assert result["type"] in ("scalar", "list", "warning")
        assert isinstance(result["decimal"], str)


def test_symbolic_scalar_marks_symbolic_output():
    result = json.loads(run_in_task("contract-symbolic", "x**2 + 1"))
    assert result["type"] == "scalar"
    assert result.get("is_symbolic") is True
    assert isinstance(result["decimal"], str)
    assert result["decimal"] == "x**2 + 1.0"
    

def test_task_state_contract():
    task_id = "contract-task-state"

    run_in_task(task_id, "a = 5")
    run_in_task(task_id, "x = sqrt(2)")

    state = json.loads(get_task_state_json(task_id))

    assert state["type"] == "scope"
    assert state["task_id"] == task_id

    variables = {
        item["name"]: item["expr"]
        for item in state["variables"]
    }

    assert variables["a"] == "5"
    assert variables["x"] == "sqrt(2)"

def test_reset_task_removes_existing_task_scope():
    from core.scope import task_registry, reset_task

    task_registry["reset-test"] = {
        "a": 42,
        "h": 6.626,
    }

    reset_task("reset-test")

    assert "reset-test" not in task_registry


def test_reset_task_accepts_unknown_task_id():
    from core.scope import task_registry, reset_task

    task_registry.pop("missing-reset-test", None)

    reset_task("missing-reset-test")

    assert "missing-reset-test" not in task_registry