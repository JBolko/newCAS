import json
from sympy import *

# 1. Gem originale Python-funktioner
py_min = min
py_max = max
py_sum = sum

# 2. Definer variable
x, y, z, t = symbols('x y z t')

# 3. Statistik-hjælpefunktioner
def mean(l):
    return py_sum(l) / len(l)

def median(l):
    s = sorted(l)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2

def Q1(data):
    s = sorted(data)
    n = len(s)
    return median(s[:n//2])

def Q3(data):
    s = sorted(data)
    n = len(s)
    if n % 2 == 0:
        return median(s[n//2:])
    return median(s[n//2 + 1:])

# 4. Overstyring af min/max
def min_func(*args):
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return py_min(data)

def max_func(*args):
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return py_max(data)

min = min_func
max = max_func
sort = sorted

def wrap_result(res):
    try:
        if isinstance(res, (list, tuple)):
            # Filtrer evt. for kun reelle rødder her senere hvis ønsket
            return json.dumps({
                "type": "list",
                "latex": ", ".join([latex(simplify(r)) for r in res]),
                "decimal": ", ".join([str(N(r)) for r in res])
            })
        
        simplified_res = simplify(res)
        return json.dumps({
            "type": "scalar",
            "latex": latex(simplified_res),
            "decimal": str(N(simplified_res)),
            "is_symbolic": bool(getattr(simplified_res, 'free_symbols', False))
        })
    except Exception as e:return json.dumps({"type": "error", "message": str(e)})
    