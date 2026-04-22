import pytest
from core.executor import run_in_task

def test_assignment_returns_success():
    res = run_in_task("test1", "x = 5\ny = 10")
    assert '"type": "success"' in res

def test_expression_with_persistent_scope():
    run_in_task("test2", "a = 3\nb = 4")
    res = run_in_task("test2", "a * b")
    assert '"type": "scalar"' in res
    assert '"decimal": "12"' in res

def test_statistics_registry():
    res = run_in_task("test3", "mean([1, 2, 3, 4, 5])")
    assert '"decimal": "3.0"' in res

def test_complex_warning():
    res = run_in_task("test4", "sqrt(-9)")
    assert '"COMPLEX_RESULT"' in res
    assert '"warning"' in res

def test_unit_conversion_fallback():
    # Konvertering der fejler skal falde back til originalt udtryk uden at crashe
    res = run_in_task("test5", "5 * meter")
    assert '"scalar"' in res or '"success"' in res

def test_forbidden_symbol_protection():
    # Forsøg på at overskrive en beskyttet funktion skal fejle eller ignoreres
    res = run_in_task("test6", "sin = 5\nsin(0)")
    assert '"error"' not in res or '"TYPE_ERROR"' not in res  # sin skal forblive callable