import json
import re as regex_module
import sympy as sympy_module
from sympy import *
from sympy.physics.units.systems import SI
from sympy.physics.units import convert_to
from sympy.physics.units import (
    second, meter, kilogram, joule, newton, pascal, watt,
    coulomb, volt, ampere, ohm, kelvin, gram,
    kilo, mega, milli, deci, centi, planck, bar, hour, minute
)

# ── 1. Celsius (håndterer forskellige SymPy-versioner) ───────────────────────
import sympy.physics.units as _u
degree_Celsius = getattr(_u, 'degree_Celsius',
                 getattr(_u, 'Celsius',
                 getattr(_u, 'degC', kelvin)))

# ── 2. Gem originale Python-funktioner ───────────────────────────────────────
py_min = min
py_max = max
py_sum = sum

# ── 3. Statistik-hjælpefunktioner ────────────────────────────────────────────
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
    return median(s[:n // 2])

def Q3(data):
    s = sorted(data)
    n = len(s)
    if n % 2 == 0:
        return median(s[n // 2:])
    return median(s[n // 2 + 1:])

def min_func(*args):
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return py_min(data)

def max_func(*args):
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return py_max(data)

# # ── 4. wrap_result (OPDATERET FOR HELTALS-PRÆCISION) ─────────────────────────
def wrap_result(res):
    try:
        if res is None:
            return json.dumps({"type": "success"})

        if isinstance(res, (list, tuple)):
            return json.dumps({
                "type": "list",
                "latex": ", ".join([latex(simplify(r)) for r in res]),
                "decimal": ", ".join([str(N(r)) for r in res])
            })

        simplified = simplify(res)

        # Mere kontant tjek for "heltals-agtige" tal
        # Hvis differencen mellem tallet og dets afrundede værdi er 0, er det et heltal.
        try:
            if float(simplified) == float(int(float(simplified))):
                simplified = Integer(int(float(simplified)))
        except:
            pass # Hvis det er et symbol (x), fejler float-konvertering, og vi lader det være

        return json.dumps({
            "type": "scalar",
            "latex": latex(simplified),
            "decimal": str(N(simplified)),
            "is_symbolic": bool(getattr(simplified, 'free_symbols', False))
        })
    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})
    
# ── 5. Enheder ───────────────────────────────────────────────────────────────
units_dict = {
    # Tid
    's': second, 'ms': milli * second, 'min': minute, 'h': hour,
    # Længde
    'm': meter, 'mm': milli * meter, 'cm': centi * meter,
    'dm': deci * meter, 'km': kilo * meter,
    # Masse
    'g': gram, 'kg': kilogram, 'mg': milli * gram,
    # Kraft, energi, effekt
    'N': newton, 'J': joule, 'kJ': kilo * joule, 'MJ': mega * joule,
    'W': watt, 'kW': kilo * watt, 'kWh': 3600000 * joule,
    # Tryk
    'Pa': pascal, 'bar': bar, 'hPa': 100 * pascal,
    # El
    'C': coulomb, 'V': volt, 'A': ampere, 'Ohm': ohm,
    # Temperatur
    'K': kelvin, 'degC': degree_Celsius, 'deltaC': kelvin,
}

# ── 6. convert_to_unit (OPDATERET MED SI-SYSTEM) ─────────────────────────────
# ── 6. convert_to_unit (bedre version – bruger officiel SymPy-metode) ───────
# ── 6. convert_to_unit (robust version til newCAS) ───────────────────────────
def convert_to_unit(expr, target_unit_str):
    try:
        # Rens målenheden: fjern [] og ^ → **
        clean = target_unit_str.replace('^', '**').replace('[', '').replace(']', '').strip()
        
        if not clean:
            return expr

        import sympy.physics.units as _spu
        ctx = {**vars(_spu), **units_dict, **vars(sympy_module)}
        
        target_unit = eval(clean, ctx)
        
        # === Hovedmetode: beregn faktor + ny enhed ===
        # (5 * m) / cm  →  500
        factor = (expr / target_unit).simplify()
        
        # Returner tal * ny enhed  →  500 * cm
        result = factor * target_unit
        
        # Hvis resultatet er et rent tal (uden enhed), tilføj enheden manuelt
        if result.is_Number:
            result = result * target_unit
        
        return result

    except Exception as e:
        print(f"⚠ convert_to_unit fejl: {type(e).__name__}: {e}")
        print(f"   target='{target_unit_str}' | expr={expr}")
        return expr
    
# ── 7. base_context ──────────────────────────────────────────────────────────
# Rækkefølge er vigtig:
#   1. SymPy-navnerum (kan override Python-builtins)
#   2. Vores egne funktioner (override SymPy hvor nødvendigt)
#   3. Enheder og konstanter
# HUSK: dict-konstruktion i Python 3.9+ evalueres venstre → højre,
# så det der kommer sidst vinder ved navnekollision.
base_context = {
    # ① Alt fra SymPy (solve, factor, diff, integrate, latex, N osv.)
    **{name: obj for name, obj in vars(sympy_module).items() if callable(obj)},

    # ② Vores funktioner — placeret EFTER sympy-spread så de ikke overskrives
    'mean':            mean,
    'median':          median,
    'Q1':              Q1,
    'Q3':              Q3,
    'min':             min_func,
    'max':             max_func,
    'wrap_result':     wrap_result,
    'convert_to_unit': convert_to_unit,
    'convert_to':      convert_to,

    # ③ Enheder og fysiske konstanter
    # VIGTIGT: units_dict har 'min': minute (minutter).
    # Vi overstyrer straks efter med min_func så min({...}) virker.
    # For enheder bruges 'min' kun i [] kontekst via transformerens Quantity-node.
    **units_dict,
    'g':               9.82 * meter / second**2,
    'h_planck':        planck,

    # ④ Gendan min/max EFTER units_dict-spread
    #    (units_dict['min'] = minute overstyrer ellers vores min_func)
    'min':             min_func,
    'max':             max_func,
    'minute':          minute,   # Elever kan stadig bruge 'minute' eksplicit
}

# ── 8. Scope-registry ────────────────────────────────────────────────────────
task_registry = {}

# Navne der aldrig må auto-symboliseres (de er funktioner, ikke variable)
FORBIDDEN_SYMBOLS = {
    'solve', 'factor', 'expand', 'simplify', 'diff', 'integrate',
    'Eq', 'Lambda', 'sqrt', 'sin', 'cos', 'tan', 'log', 'exp',
    'mean', 'median', 'Q1', 'Q3', 'min', 'max',
    'wrap_result', 'convert_to_unit', 'convert_to',
    'Matrix', 'symbols', 'Symbol', 'N', 'latex',
}

def run_in_task(task_id, code): 
    if task_id not in task_registry:
        task_registry[task_id] = {}

    locs  = task_registry[task_id]
    globs = base_context

    try:
        # Kør koden — auto-opret symboler ved NameError
        attempts = 0
        while attempts < 10:
            try:
                exec(code, globs, locs)
                break
            except NameError as e:
                match = regex_module.search(r"name '(.+)' is not defined", str(e))
                if match:
                    var_name = match.group(1)
                    if var_name in FORBIDDEN_SYMBOLS:
                        raise  # Videre — dette er en reel fejl
                    locs[var_name] = Symbol(var_name)
                    attempts += 1
                else:
                    raise

        # Evaluer den sidste ikke-tomme, ikke-kommentar linje for et resultat
        lines = [l for l in code.strip().split('\n')
                 if l.strip() and not l.strip().startswith('#')]

        if not lines:
            return json.dumps({"type": "success"})

        last_line = lines[-1]

        # Hvis linjen indeholder en tildeling, skal vi ikke prøve at eval'e den som et resultat
        if ":=" in last_line or ( "=" in last_line and "==" not in last_line):
            return json.dumps({"type": "success"})
        
        try:
            last_val = eval(last_line, globs, locs)
            return wrap_result(last_val)
        except SyntaxError:
            # Sidste linje er en sætning (tildeling, def osv.) — ikke et udtryk
            return json.dumps({"type": "success"})

    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})
