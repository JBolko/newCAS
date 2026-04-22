from typing import Any
from sympy import limit, integrate, diff, sqrt, Basic
from .registry import register

@register("limit", forbidden=True, category="calculus")
def limit_cas(*args: Any) -> Any:
    """Wrapper til sympy.limit med understøttelse af ensidede grænseværdier."""
    if len(args) == 4:
        expr, var, point, direction = args
        d_str = str(direction).strip().lower()
        if d_str in ('+', 'højre', 'right', 'h'):
            return limit(expr, var, point, '+')
        elif d_str in ('-', 'venstre', 'left', 'v'):
            return limit(expr, var, point, '-')
    return limit(*args)

@register("integrate", forbidden=True, category="calculus")
def integrate_cas(*args: Any) -> Any:
    """Wrapper til sympy.integrate (ubestemt & bestemt)."""
    if len(args) == 4:
        expr, var, lower, upper = args
        return integrate(expr, (var, lower, upper))
    return integrate(*args)

@register("arclength", forbidden=True, category="calculus")
def arclength(expr: Basic, var: Basic, lower: Any, upper: Any) -> Basic:
    """Beregner kurvelængde: ∫√(1 + (dy/dx)²) dx"""
    derivative = diff(expr, var)
    integrand = sqrt(1 + derivative**2)
    return integrate(integrand, (var, lower, upper))