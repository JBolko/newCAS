"""
Statistik og regression-funktioner — uden NumPy-dependency.
Plain functions — registreres af registry.py

Designregel: Ingen imports fra cas_math. Ingen decorators.
"""

import math
from sympy import sympify as _sympify


# ─── HJÆLPEFUNKTION ───────────────────────────────────────────────────────────

def _to_floats(data):
    """Konverterer liste af SymPy-objekter eller tal til Python-floats."""
    return [float(_sympify(v)) for v in data]


# ─── GRUNDLÆGGENDE STATISTIK ──────────────────────────────────────────────────

def mean(data):
    """Aritmetisk middelværdi."""
    return sum(data) / len(data)


def median(data):
    """Median."""
    s = sorted(data)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2


def Q1(data):
    """Første kvartil (nedre)."""
    s = sorted(data)
    return median(s[: len(s) // 2])


def Q3(data):
    """Tredje kvartil (øvre)."""
    s = sorted(data)
    n = len(s)
    upper = s[n // 2 :] if n % 2 == 0 else s[n // 2 + 1 :]
    return median(upper)


def min_func(*args):
    """Minimum — accepterer liste eller enkeltargumenter."""
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return min(data)


def max_func(*args):
    """Maksimum — accepterer liste eller enkeltargumenter."""
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return max(data)


# ─── REGRESSION ───────────────────────────────────────────────────────────────

def _r_squared(y, y_pred):
    """Beregner R² (forklaringsgrad)."""
    y_mean = sum(y) / len(y)
    ss_tot = sum((yi - y_mean) ** 2 for yi in y)
    ss_res = sum((yi - ypi) ** 2 for yi, ypi in zip(y, y_pred))
    return 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0


def linReg(x_data, y_data):
    """Lineær regression: y = a·x + b."""
    x = _to_floats(x_data)
    y = _to_floats(y_data)
    n = len(x)

    sum_x  = sum(x)
    sum_y  = sum(y)
    sum_x2 = sum(xi ** 2 for xi in x)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))

    denom = n * sum_x2 - sum_x ** 2
    a = (n * sum_xy - sum_x * sum_y) / denom if denom != 0 else 0.0
    b = (sum_y - a * sum_x) / n

    y_pred = [a * xi + b for xi in x]
    r2 = _r_squared(y, y_pred)

    return {
        'type': 'regression', 'model': 'linReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g}x + {b:.6g}',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2),
    }


def expReg(x_data, y_data):
    """Eksponentiel regression: y = a·e^(b·x)."""
    x = _to_floats(x_data)
    y = _to_floats(y_data)
    n = len(x)

    ln_y       = [math.log(yi) for yi in y]
    sum_x      = sum(x)
    sum_ln_y   = sum(ln_y)
    sum_x2     = sum(xi ** 2 for xi in x)
    sum_x_ln_y = sum(xi * lyi for xi, lyi in zip(x, ln_y))

    denom = n * sum_x2 - sum_x ** 2
    b     = (n * sum_x_ln_y - sum_x * sum_ln_y) / denom if denom != 0 else 0.0
    a     = math.exp((sum_ln_y - b * sum_x) / n)

    y_pred = [a * math.exp(b * xi) for xi in x]
    r2 = _r_squared(y, y_pred)

    return {
        'type': 'regression', 'model': 'expReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g} e^{{{b:.6g}x}}',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2),
    }


def powReg(x_data, y_data):
    """Potens-regression: y = a·x^b."""
    x = _to_floats(x_data)
    y = _to_floats(y_data)
    n = len(x)

    ln_x          = [math.log(xi) for xi in x]
    ln_y          = [math.log(yi) for yi in y]
    sum_ln_x      = sum(ln_x)
    sum_ln_y      = sum(ln_y)
    sum_ln_x2     = sum(lxi ** 2 for lxi in ln_x)
    sum_ln_x_ln_y = sum(lxi * lyi for lxi, lyi in zip(ln_x, ln_y))

    denom = n * sum_ln_x2 - sum_ln_x ** 2
    b     = (n * sum_ln_x_ln_y - sum_ln_x * sum_ln_y) / denom if denom != 0 else 0.0
    a     = math.exp((sum_ln_y - b * sum_ln_x) / n)

    y_pred = [a * (xi ** b) for xi in x]
    r2 = _r_squared(y, y_pred)

    return {
        'type': 'regression', 'model': 'powReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g} x^{{{b:.6g}}}',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2),
    }


def logReg(x_data, y_data):
    """Logaritmisk regression: y = a + b·ln(x)."""
    x = _to_floats(x_data)
    y = _to_floats(y_data)
    n = len(x)

    ln_x       = [math.log(xi) for xi in x]
    sum_ln_x   = sum(ln_x)
    sum_y      = sum(y)
    sum_ln_x2  = sum(lxi ** 2 for lxi in ln_x)
    sum_ln_x_y = sum(lxi * yi for lxi, yi in zip(ln_x, y))

    denom = n * sum_ln_x2 - sum_ln_x ** 2
    b     = (n * sum_ln_x_y - sum_ln_x * sum_y) / denom if denom != 0 else 0.0
    a     = (sum_y - b * sum_ln_x) / n

    y_pred = [a + b * lxi for lxi in ln_x]
    r2 = _r_squared(y, y_pred)

    return {
        'type': 'regression', 'model': 'logReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g} + {b:.6g} \\ln(x)',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2),
    }
