"""
Statistik og regression-funktioner — uden NumPy dependency
Plain functions - registreres af registry.py
"""

import sympy as sp

# KUN plain functions - INGEN imports fra cas_math, INGEN decorators

# ─── GRUNDLÆGGENDE STATISTIK ───────────────────────────────

def mean(data):
    """Gennemsnit"""
    return sum(data) / len(data)

def median(data):
    """Median"""
    s = sorted(data)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2

def Q1(data):
    """Første kvartil"""
    s = sorted(data)
    return median(s[:len(s) // 2])

def Q3(data):
    """Tredje kvartil"""
    s = sorted(data)
    n = len(s)
    upper = s[n // 2:] if n % 2 == 0 else s[n // 2 + 1:]
    return median(upper)

def min_func(*args):
    """Minimum"""
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return min(data)

def max_func(*args):
    """Maksimum"""
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return max(data)

# ─── REGRESSION (bruger SymPy's least squares) ────────────────────────────

def _numeric_array(data):
    """Konverter liste af SymPy-objekter til floats"""
    from sympy import sympify
    return [float(sympify(v)) for v in data]

def linReg(x_data, y_data):
    """Lineær regression: y = a*x + b"""
    x = _numeric_array(x_data)
    y = _numeric_array(y_data)
    n = len(x)
    
    # Formler for lineær regression
    sum_x = sum(x)
    sum_y = sum(y)
    sum_x2 = sum(xi**2 for xi in x)
    sum_xy = sum(xi*yi for xi, yi in zip(x, y))
    
    denom = n * sum_x2 - sum_x**2
    a = (n * sum_xy - sum_x * sum_y) / denom if denom != 0 else 0
    b = (sum_y - a * sum_x) / n
    
    # R²
    y_mean = sum_y / n
    ss_tot = sum((yi - y_mean)**2 for yi in y)
    y_pred = [a*xi + b for xi in x]
    ss_res = sum((yi - ypi)**2 for yi, ypi in zip(y, y_pred))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'type': 'regression',
        'model': 'linReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g}x + {b:.6g}',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2)
    }

def expReg(x_data, y_data):
    """Eksponentiel regression: y = a*exp(b*x)"""
    import math
    x = _numeric_array(x_data)
    y = _numeric_array(y_data)
    
    # Linearisering: ln(y) = ln(a) + b*x
    ln_y = [math.log(yi) for yi in y]
    n = len(x)
    
    sum_x = sum(x)
    sum_ln_y = sum(ln_y)
    sum_x2 = sum(xi**2 for xi in x)
    sum_x_ln_y = sum(xi*lyi for xi, lyi in zip(x, ln_y))
    
    denom = n * sum_x2 - sum_x**2
    b = (n * sum_x_ln_y - sum_x * sum_ln_y) / denom if denom != 0 else 0
    ln_a = (sum_ln_y - b * sum_x) / n
    a = math.exp(ln_a)
    
    # R²
    y_mean = sum(y) / n
    ss_tot = sum((yi - y_mean)**2 for yi in y)
    y_pred = [a * math.exp(b * xi) for xi in x]
    ss_res = sum((yi - ypi)**2 for yi, ypi in zip(y, y_pred))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'type': 'regression',
        'model': 'expReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g} e^{{{b:.6g}x}}',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2)
    }

def powReg(x_data, y_data):
    """Potens regression: y = a*x^b"""
    import math
    x = _numeric_array(x_data)
    y = _numeric_array(y_data)
    
    # Linearisering: ln(y) = ln(a) + b*ln(x)
    ln_x = [math.log(xi) for xi in x]
    ln_y = [math.log(yi) for yi in y]
    n = len(x)
    
    sum_ln_x = sum(ln_x)
    sum_ln_y = sum(ln_y)
    sum_ln_x2 = sum(lxi**2 for lxi in ln_x)
    sum_ln_x_ln_y = sum(lxi*lyi for lxi, lyi in zip(ln_x, ln_y))
    
    denom = n * sum_ln_x2 - sum_ln_x**2
    b = (n * sum_ln_x_ln_y - sum_ln_x * sum_ln_y) / denom if denom != 0 else 0
    ln_a = (sum_ln_y - b * sum_ln_x) / n
    a = math.exp(ln_a)
    
    # R²
    y_mean = sum(y) / n
    ss_tot = sum((yi - y_mean)**2 for yi in y)
    y_pred = [a * (xi ** b) for xi in x]
    ss_res = sum((yi - ypi)**2 for yi, ypi in zip(y, y_pred))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'type': 'regression',
        'model': 'powReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g} x^{{{b:.6g}}}',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2)
    }

def logReg(x_data, y_data):
    """Logaritmisk regression: y = a + b*ln(x)"""
    import math
    x = _numeric_array(x_data)
    y = _numeric_array(y_data)
    
    # Linearisering: y = a + b*ln(x)
    ln_x = [math.log(xi) for xi in x]
    n = len(x)
    
    sum_ln_x = sum(ln_x)
    sum_y = sum(y)
    sum_ln_x2 = sum(lxi**2 for lxi in ln_x)
    sum_ln_x_y = sum(lxi*yi for lxi, yi in zip(ln_x, y))
    
    denom = n * sum_ln_x2 - sum_ln_x**2
    b = (n * sum_ln_x_y - sum_ln_x * sum_y) / denom if denom != 0 else 0
    a = (sum_y - b * sum_ln_x) / n
    
    # R²
    y_mean = sum_y / n
    ss_tot = sum((yi - y_mean)**2 for yi in y)
    y_pred = [a + b * lxi for lxi in ln_x]
    ss_res = sum((yi - ypi)**2 for yi, ypi in zip(y, y_pred))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'type': 'regression',
        'model': 'logReg',
        'params': {'a': float(a), 'b': float(b)},
        'latex': f'y = {a:.6g} + {b:.6g} ln(x)',
        'decimal': f'a = {a:.6g}, b = {b:.6g}',
        'r_squared': float(r2)
    }
