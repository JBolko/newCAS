"""
Calculus-funktioner: diff, integrate, limit, arclength
Plain functions - registreres af registry.py
"""

from sympy import (
    symbols, diff, integrate, limit as sp_limit, sqrt, oo, atan2,
    pi, lambdify, Float, N, Symbol, Basic, Function, Derivative
)

# KUN plain functions - INGEN imports fra cas_math, INGEN decorators

def diff(expr: Basic, var: Basic, order: int = 1) -> Basic:
    """Afledede: diff(f; x) eller diff(f; x; n) for n'te afledet"""
    from sympy import diff as sp_diff
    return sp_diff(expr, var, order)

def integrate_cas(expr: Basic, *args) -> Basic:
    """
    Ubestemt integral: integrate(f; x)
    Bestemt integral: integrate(f; x; a; b) — args bliver (x, a, b)
    """
    from sympy import integrate as sp_integrate
    if len(args) == 1:
        # Ubestemt: integrate(f; x)
        return sp_integrate(expr, args[0])
    else:
        # Bestemt: args = (x, a, b) fra transformer
        return sp_integrate(expr, args)

def limit(expr: Basic, var: Basic, point: Basic, direction: Symbol = None) -> Basic:
    """
    Grænseværdi: limit(f; x; a) eller limit(f; x; a; 'højre'/'venstre')
    direction kommer som Symbol('højre') eller Symbol('venstre') hvis sat
    """
    from sympy import limit as sp_limit
    
    if direction is None:
        return sp_limit(expr, var, point)
    
    # direction er en Symbol — tjek dens navn
    dir_str = str(direction)
    if 'højre' in dir_str or 'right' in dir_str:
        return sp_limit(expr, var, point, '+')
    elif 'venstre' in dir_str or 'left' in dir_str:
        return sp_limit(expr, var, point, '-')
    else:
        return sp_limit(expr, var, point)

def arclength(expr: Basic, var: Basic, lower: Basic, upper: Basic) -> Basic:
    """Kurvelængde: ∫√(1 + (dy/dx)²) dx fra a til b"""
    from sympy import diff as sp_diff, integrate as sp_integrate, sqrt
    derivative = sp_diff(expr, var)
    integrand = sqrt(1 + derivative**2)
    return sp_integrate(integrand, (var, lower, upper))
