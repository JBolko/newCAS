"""
Calculus-funktioner: diff, integrate, limit, arclength
Plain functions — registreres af registry.py

Designregel: Ingen imports fra cas_math. Ingen decorators.
SymPy-navne importeres med _ præfiks øverst så lokale funktionsnavne
ikke skygger for dem (undgår behovet for re-import inde i funktioner).
"""

from sympy import (
    diff      as _sp_diff,
    integrate as _sp_integrate,
    limit     as _sp_limit,
    sqrt      as _sp_sqrt,
)
from sympy import Basic, Symbol   # bruges kun til type-hints i docstrings


# ─── DIFFERENTIALREGNING ──────────────────────────────────────────────────────

def diff(expr, var, order=1):
    """
    Afledede: diff(f; x) eller diff(f; x; n) for n'te afledet.

    Eksempel:
        diff(x**2, x)     → 2*x
        diff(x**3, x, 2)  → 6*x
    """
    return _sp_diff(expr, var, order)


# ─── INTEGRALREGNING ──────────────────────────────────────────────────────────

def integrate_cas(expr, *args):
    """
    Ubestemt integral:  integrate(f; x)         → args = (x,)
    Bestemt integral:   integrate(f; x; a; b)   → args = (x, a, b)

    Transformer sender altid (var, lower, upper) som *args.
    SymPy forventer (expr, (var, lower, upper)) for det bestemte tilfælde.
    """
    if len(args) == 1:
        return _sp_integrate(expr, args[0])
    else:
        # args = (var, lower, upper) — pak til tuple som SymPy kræver
        return _sp_integrate(expr, args)


# ─── GRÆNSEVÆRDIER ────────────────────────────────────────────────────────────

def limit(expr, var, point, direction=None):
    """
    Grænseværdi: limit(f; x; a) eller limit(f; x; a; 'højre'/'venstre').

    direction kommer som Symbol('højre') / Symbol('venstre') fra parseren.
    Mapper til SymPy's '+' / '-' konvention.
    """
    if direction is None:
        return _sp_limit(expr, var, point)

    dir_str = str(direction).lower()
    if 'højre' in dir_str or 'right' in dir_str:
        return _sp_limit(expr, var, point, '+')
    elif 'venstre' in dir_str or 'left' in dir_str:
        return _sp_limit(expr, var, point, '-')
    else:
        return _sp_limit(expr, var, point)


# ─── KURVELÆNGDE ──────────────────────────────────────────────────────────────

def arclength(expr, var, lower, upper):
    """
    Kurvelængde: ∫√(1 + (dy/dx)²) dx fra lower til upper.

    Eksempel:
        arclength(x**2, x, 0, 1)  → ∫₀¹ √(1 + 4x²) dx
    """
    derivative = _sp_diff(expr, var)
    integrand  = _sp_sqrt(1 + derivative**2)
    return _sp_integrate(integrand, (var, lower, upper))
