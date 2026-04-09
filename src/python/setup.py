import json
from sympy import *
from sympy.physics.units import *

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
 
# 5. Fysik og Scopes

# Vi definerer de enheder, som Transformeren spytter ud (m, s, kg osv.)
units_dict = {
    'm': meter, 's': second, 'kg': kilogram, 'J': joule, 'N': newton, 'Pa': pascal
}

# Grundlæggende konstanter og funktioner (Baseline)
base_context = {
    **globals(),       # Inkluderer x, y, z, t, mean, wrap_result osv.
    **units_dict,      # Inkluderer enhederne
    'g': 9.82 * meter / second**2,
    'h_planck': planck,
}

task_registry = {}

def run_in_task(task_id, code):
    if task_id not in task_registry:
        task_registry[task_id] = {}
    
    # Vi bruger base_context som "globals" og task_registry som "locals"
    # Det er den mest robuste måde at køre exec/eval på.
    locs = task_registry[task_id]
    globs = base_context

    try:
        # Tjek om det er en tildeling (Assignment)
        if "=" in code and "Eq(" not in code:
            exec(code, globs, locs)
            return json.dumps({"status": "success"})
        else:
            # Det er et udtryk der skal beregnes
            result = eval(code, globs, locs)
            return wrap_result(result)
            
    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})