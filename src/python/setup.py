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

# ── 1. Celsius ───────────────────────────────────────────────────────────────
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

# ── 4. wrap_result (forbedret til heltal + enheder) ──────────────────────────
def wrap_result(res):
    try:
        if res is None:
            return json.dumps({"type": "success"})

        if isinstance(res, (list, tuple)):
            # Special case fra convert_to_unit: (værdi, enhed_str)
            if len(res) == 2 and isinstance(res[0], (int, float)):
                value, unit_str = res
                latex_str = f"{value} \\, \\text{{{unit_str}}}"
                return json.dumps({
                    "type": "scalar",
                    "latex": latex_str,
                    "decimal": str(value)
                })

            # Normal list
            return json.dumps({
                "type": "list",
                "latex": ", ".join([latex(simplify(r)) for r in res]),
                "decimal": ", ".join([str(N(r)) for r in res])
            })

        # Specialhåndtering af heltals-divisioner (15/3 → 5)
        if isinstance(res, (int, float, Float, Rational)):
            # Hvis det er et helt tal (ingen decimaldel)
            if float(res).is_integer():
                value = int(float(res))
                return json.dumps({
                    "type": "scalar",
                    "latex": str(value),
                    "decimal": str(value)
                })
            else:
                return json.dumps({
                    "type": "scalar",
                    "latex": latex(Rational(res).limit_denominator(1000) if isinstance(res, float) else res),
                    "decimal": str(float(res))   # Altid numerisk — aldrig "1/2"
                })

        # Normal symbolsk/scalar case
        simplified = simplify(res)

        try:
            if float(simplified).is_integer():
                simplified = Integer(int(float(simplified)))
        except:
            pass

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
    's': second, 'ms': milli * second, 'min': minute, 'h': hour,
    'm': meter, 'mm': milli * meter, 'cm': centi * meter,
    'dm': deci * meter, 'km': kilo * meter,
    'g': gram, 'kg': kilogram, 'mg': milli * gram,
    'N': newton, 'J': joule, 'kJ': kilo * joule, 'MJ': mega * joule,
    'W': watt, 'kW': kilo * watt, 'kWh': 3600000 * joule,
    'Pa': pascal, 'bar': bar, 'hPa': 100 * pascal,
    'C': coulomb, 'V': volt, 'A': ampere, 'Ohm': ohm, 'mA': milli * ampere, 'kV': kilo * volt,
    'K': kelvin, 'degC': degree_Celsius, 'deltaC': kelvin,
}

# ── 6. convert_to_unit ───────────────────────────────────────────────────────
def convert_to_unit(expr, target_unit_str):
    try:
        clean = target_unit_str.replace('^', '**').replace('[', '').replace(']', '').strip()
        if not clean:
            return expr

        import sympy.physics.units as _spu
        ctx = {**vars(_spu), **units_dict, **vars(sympy_module)}
        
        target_unit = eval(clean, ctx)

        factor = float(N((expr / target_unit).simplify()))

        print(f"convert_to_unit OK: {expr} → {factor} {target_unit}")
        
        return (factor, str(target_unit))   # tuple til wrap_result

    except Exception as e:
        print(f"⚠ convert_to_unit FEJL: {type(e).__name__}: {e}")
        print(f"   target='{target_unit_str}' | expr={expr}")
        return expr

# ── 7. base_context ──────────────────────────────────────────────────────────
base_context = {
    **{name: obj for name, obj in vars(sympy_module).items() if callable(obj)},

    'mean':            mean,
    'median':          median,
    'Q1':              Q1,
    'Q3':              Q3,
    'min':             min_func,
    'max':             max_func,
    'wrap_result':     wrap_result,
    'convert_to_unit': convert_to_unit,
    'convert_to':      convert_to,

    **units_dict,
    'g':               9.82 * meter / second**2,
    'h_planck':        planck,

    'min':             min_func,
    'max':             max_func,
    'minute':          minute,

    # ⑤ Matematiske konstanter — IKKE callable, filtreres fra af vars()
    #    Skal tilføjes eksplicit, ellers opretter auto-symbol-handleren
    #    Symbol('pi') i stedet for den rigtige π-konstant.
    'pi':  sympy_module.pi,
    'E':   sympy_module.E,
    'I':   sympy_module.I,
    'oo':  sympy_module.oo,
    'zoo': sympy_module.zoo,
    'nan': sympy_module.nan,
}

# ── 8. Scope-registry ────────────────────────────────────────────────────────
task_registry = {}

FORBIDDEN_SYMBOLS = {
    'solve', 'factor', 'expand', 'simplify', 'diff', 'integrate',
    'Eq', 'Lambda', 'sqrt', 'sin', 'cos', 'tan', 'log', 'exp',
    'mean', 'median', 'Q1', 'Q3', 'min', 'max',
    'wrap_result', 'convert_to_unit', 'convert_to',
    'Matrix', 'symbols', 'Symbol', 'N', 'latex',
    # Konstanter — må aldrig auto-symboliseres
    'pi', 'E', 'I', 'oo', 'zoo', 'nan',
}

def run_in_task(task_id, code):
    code = code.replace('^', '**')
    
    if task_id not in task_registry:
        task_registry[task_id] = {}

    locs  = task_registry[task_id]
    globs = base_context

    try:
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
                        raise
                    locs[var_name] = Symbol(var_name)
                    attempts += 1
                else:
                    raise

        lines = [l for l in code.strip().split('\n')
                 if l.strip() and not l.strip().startswith('#')]

        if not lines:
            return json.dumps({"type": "success"})

        last_line = lines[-1]

        if ":=" in last_line or ("=" in last_line and "==" not in last_line and "Eq" not in last_line):
            return json.dumps({"type": "success"})

        try:
            last_val = eval(last_line, globs, locs)
            return wrap_result(last_val)
        except SyntaxError:
            return json.dumps({"type": "success"})

    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})