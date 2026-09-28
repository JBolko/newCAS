import json
import sys
import traceback

import sympy as sp


def describe(value):
    """Stable observation envelope; not a proposed newCAS Value format."""
    data = {
        "python_type": f"{type(value).__module__}.{type(value).__qualname__}",
        "str": str(value),
        "repr": repr(value),
    }
    if isinstance(value, sp.Basic):
        data.update({
            "sympy_func": value.func.__name__,
            "srepr": sp.srepr(value),
            "free_symbols": sorted(str(s) for s in value.free_symbols),
        })
    return data


def run_case(case_id, fn):
    try:
        value = fn()
        return {"id": case_id, "status": "ok", "value": describe(value)}
    except Exception as exc:
        return {
            "id": case_id,
            "status": "error",
            "error_type": f"{type(exc).__module__}.{type(exc).__qualname__}",
            "error_class": type(exc).__qualname__,
            "message": str(exc),
            "traceback": traceback.format_exc(limit=3),
        }


x = sp.Symbol("x")
y = sp.Symbol("y")


def symbol_same_name():
    a = sp.Symbol("x")
    b = sp.Symbol("x")
    return sp.Tuple(a == b, a is b, a, b)


def dummy_same_name():
    a = sp.Dummy("x")
    b = sp.Dummy("x")
    return sp.Tuple(a == b, a is b, a, b, a + b)


def substitution_capture():
    a = sp.Symbol("a")
    t = sp.Dummy("t")
    expr = sp.Integral(a + t, (t, 0, 1))
    return sp.Tuple(expr, expr.subs(a, t))


def lambda_capture():
    a = sp.Symbol("a")
    t = sp.Dummy("t")
    f = sp.Lambda(t, a + t)
    return sp.Tuple(f, f(t), f.subs(a, t))


def function_substitution():
    f = sp.Lambda(x, x**2 + 1)
    return sp.Tuple(f, f(3), f(x + 1))


def solveset_finite():
    return sp.solveset(x**2 - 1, x, domain=sp.S.Reals)


def solveset_conditionset():
    # Deliberately chosen to expose an unevaluated/conditional solve form.
    return sp.solveset(sp.cos(x) - x, x, domain=sp.S.Reals)


def solve_relational():
    return sp.solve_univariate_inequality(x**2 < 4, x, relational=False)


def limit_infinity():
    return sp.limit((1 + 1/x)**x, x, sp.oo)


def limit_special():
    return sp.limit(sp.sin(x)/x, x, 0)


def limit_default_direction_reference():
    # SymPy default direction is not newCAS two-sided semantics.
    return sp.limit(1/x, x, 0)

def limit_bidirectional_pole():
    return sp.limit(1/x, x, 0, dir="+-")

def limit_bidirectional_jump():
    return sp.limit(sp.Abs(x)/x, x, 0, dir="+-")

def limit_piecewise_bidirectional():
    f = sp.Piecewise((0, x < 0), (1, True))
    return sp.limit(f, x, 0, dir="+-")

def limit_piecewise_removable():
    f = sp.Piecewise((sp.sin(x)/x, sp.Ne(x, 0)), (99, True))
    return sp.limit(f, x, 0, dir="+-")


def special_values():
    return sp.Tuple(sp.oo, -sp.oo, sp.zoo, sp.nan, sp.S.ComplexInfinity)


def matrix_basic():
    m = sp.Matrix([[1, 2], [3, 4]])
    return sp.Tuple(m, m.det(), m.inv(), m.eigenvals())


def matrix_singular():
    m = sp.Matrix([[1, 2], [2, 4]])
    return m.inv()


def units_basic():
    from sympy.physics import units as u
    q = 3 * u.meter / u.second
    return sp.Tuple(q, sp.physics.units.convert_to(q, u.kilometer/u.hour))


def units_dimensions():
    from sympy.physics import units as u
    return sp.physics.units.convert_to(1*u.joule, u.kilogram*u.meter**2/u.second**2)


def numeric_exact_vs_float():
    exact = sp.Rational(1, 3) + sp.Rational(1, 6)
    return sp.Tuple(exact, sp.N(exact, 30), sp.Float("0.1") + sp.Float("0.2"))


def statistics_symbolic():
    values = [sp.Integer(1), sp.Integer(2), sp.Integer(4)]
    return sp.Tuple(
        sum(values) / len(values),
        sp.sqrt(sum((v - sum(values)/len(values))**2 for v in values) / len(values))
    )


def serialization_objects():
    finite = sp.FiniteSet(sp.Integer(-1), sp.Integer(1))
    interval = sp.Interval.open(-2, 2)
    mat = sp.Matrix([[sp.Rational(1, 2), sp.sqrt(2)]])
    return sp.Tuple(finite, interval, mat, sp.Eq(x**2, 2), sp.sin(x))



# ---------- Focused backend capability probes ----------

def limit_one_sided_pole():
    return sp.Tuple(sp.limit(1/x, x, 0, dir="-"), sp.limit(1/x, x, 0, dir="+"))

def limit_abs_over_x():
    return sp.Tuple(sp.limit(sp.Abs(x)/x, x, 0, dir="-"),
                    sp.limit(sp.Abs(x)/x, x, 0, dir="+"))

def limit_oscillatory():
    return sp.limit(sp.sin(1/x), x, 0, dir="+")

def limit_piecewise_jump():
    f = sp.Piecewise((0, x < 0), (1, True))
    return sp.Tuple(sp.limit(f, x, 0, dir="-"), sp.limit(f, x, 0, dir="+"))

def solveset_empty():
    return sp.solveset(x**2 + 1, x, domain=sp.S.Reals)

def solveset_infinite_periodic():
    return sp.solveset(sp.sin(x), x, domain=sp.S.Reals)

def solveset_complex():
    return sp.solveset(x**2 + 1, x, domain=sp.S.Complexes)

def solveset_parameterized():
    a = sp.Symbol("a")
    return sp.solveset(a*x - 1, x, domain=sp.S.Reals)

def set_union_intersection():
    a = sp.Interval.open(-2, 1)
    b = sp.Interval(0, 3)
    return sp.Tuple(sp.Union(a, b), sp.Intersection(a, b))

def dummy_substitution_by_same_printed_name():
    d1, d2 = sp.Dummy("x"), sp.Dummy("x")
    expr = d1 + 1
    return sp.Tuple(expr, expr.subs(d1, 7), expr.subs(d2, 7))

def lambda_alpha_equivalence():
    a, b = sp.Dummy("a"), sp.Dummy("b")
    f, g = sp.Lambda(a, a + 1), sp.Lambda(b, b + 1)
    return sp.Tuple(f, g, f == g, f.dummy_eq(g))

def integral_bound_vs_free():
    t = sp.Symbol("t")
    expr = t + sp.Integral(t, (t, 0, 1))
    return sp.Tuple(expr, expr.free_symbols)

def simultaneous_substitution():
    expr = x + y
    return sp.Tuple(expr.subs({x: y, y: x}, simultaneous=True),
                    expr.subs({x: y, y: x}))

def matrix_shape_error():
    return sp.Matrix([[1, 2]]) + sp.Matrix([[1], [2]])

def invalid_unit_conversion():
    from sympy.physics import units as u
    return sp.physics.units.convert_to(u.meter, u.second)

def unit_dimensional_expressions():
    from sympy.physics import units as u
    from sympy.physics.units.systems.si import SI
    return sp.Tuple(
        SI.get_dimensional_expr(u.meter),
        SI.get_dimensional_expr(u.second),
        SI.get_dimensional_expr(u.meter/u.second),
    )

def solve_bad_target():
    return sp.solveset(x**2 - 1, x + 1, domain=sp.S.Reals)

CASES = [
    ("identity.symbol_same_name", symbol_same_name),
    ("identity.dummy_same_name", dummy_same_name),
    ("identity.substitution_capture", substitution_capture),
    ("function.lambda_capture", lambda_capture),
    ("function.substitution", function_substitution),
    ("solve.finite_set", solveset_finite),
    ("solve.condition_or_unevaluated", solveset_conditionset),
    ("solve.inequality_set", solve_relational),
    ("limit.infinity", limit_infinity),
    ("limit.zero", limit_special),
    ("limit.default_direction_reference", limit_default_direction_reference),
    ("limit.bidirectional_pole", limit_bidirectional_pole),
    ("limit.bidirectional_jump", limit_bidirectional_jump),
    ("limit.piecewise_bidirectional", limit_piecewise_bidirectional),
    ("limit.piecewise_removable", limit_piecewise_removable),
    ("special.values", special_values),
    ("matrix.basic", matrix_basic),
    ("matrix.singular_inverse", matrix_singular),
    ("units.basic_conversion", units_basic),
    ("units.dimensions", units_dimensions),
    ("numeric.exact_vs_float", numeric_exact_vs_float),
    ("statistics.symbolic_path", statistics_symbolic),
    ("serialization.representative_objects", serialization_objects),
    ("limit.one_sided_pole", limit_one_sided_pole),
    ("limit.abs_over_x", limit_abs_over_x),
    ("limit.oscillatory", limit_oscillatory),
    ("limit.piecewise_jump", limit_piecewise_jump),
    ("solve.empty_set", solveset_empty),
    ("solve.infinite_periodic", solveset_infinite_periodic),
    ("solve.complex", solveset_complex),
    ("solve.parameterized", solveset_parameterized),
    ("set.union_intersection", set_union_intersection),
    ("identity.dummy_substitution", dummy_substitution_by_same_printed_name),
    ("identity.lambda_alpha_equivalence", lambda_alpha_equivalence),
    ("identity.integral_bound_vs_free", integral_bound_vs_free),
    ("identity.simultaneous_substitution", simultaneous_substitution),
    ("error.matrix_shape", matrix_shape_error),
    ("error.invalid_unit_conversion", invalid_unit_conversion),
    ("units.dimensional_expressions", unit_dimensional_expressions),
    ("error.solve_bad_target", solve_bad_target),
]

result = {
    "probe_schema": 3,
    "purpose": "Reusable backend capability probe for newCAS",
    "case_count": len(CASES),
    "python_version": sys.version,
    "sympy_version": sp.__version__,
    "cases": [run_case(case_id, fn) for case_id, fn in CASES],
}

json.dumps(result, ensure_ascii=False, indent=2, default=str)
