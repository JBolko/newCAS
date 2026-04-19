"""
setup.py — newCAS Python-motor
Køres én gang ved Pyodide-opstart. Definerer det fælles navnerum
(base_context), scope-registret (task_registry) og alle hjælpefunktioner.
"""

import json
import re as regex_module
import sympy as sympy_module
from sympy import *
from sympy.physics.units import convert_to
from sympy.physics.units import (
    second, meter, kilogram, joule, newton, pascal, watt,
    coulomb, volt, ampere, ohm, kelvin, gram,
    kilo, mega, milli, deci, centi, planck, bar, hour, minute,
)

# ── 1. Celsius ───────────────────────────────────────────────────────────────
import sympy.physics.units as _u
degree_Celsius = getattr(_u, 'degree_Celsius',
                 getattr(_u, 'Celsius',
                 getattr(_u, 'degC', kelvin)))

# ── 2. Bevar originale Python-builtins ───────────────────────────────────────
_py_min = min
_py_max = max
_py_sum = sum

# ── 3. Statistik ─────────────────────────────────────────────────────────────

def mean(data):
    return _py_sum(data) / len(data)

def median(data):
    s = sorted(data)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2

def Q1(data):
    s = sorted(data)
    return median(s[:len(s) // 2])

def Q3(data):
    s = sorted(data)
    n = len(s)
    upper = s[n // 2:] if n % 2 == 0 else s[n // 2 + 1:]
    return median(upper)

def min_func(*args):
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return _py_min(data)

def max_func(*args):
    data = args[0] if len(args) == 1 and isinstance(args[0], (list, tuple)) else args
    return _py_max(data)

# ── 4. Fejlklassificering ────────────────────────────────────────────────────

def classify_error(exc):
    """Returnerer en maskinlæsbar fejlkode som JS oversætter til dansk."""
    t = type(exc).__name__
    s = str(exc)
    if isinstance(exc, ZeroDivisionError):            return 'ZERO_DIVISION'
    if isinstance(exc, RecursionError):               return 'RECURSION'
    if isinstance(exc, OverflowError):                return 'OVERFLOW'
    if isinstance(exc, NameError):                    return 'UNDEFINED_NAME'
    if isinstance(exc, TypeError):                    return 'TYPE_ERROR'
    if 'NonInvertibleMatrix' in t:                    return 'SINGULAR_MATRIX'
    if 'NonSquareMatrix'     in t:                    return 'NON_SQUARE_MATRIX'
    if 'sympy' in s.lower() or 'sympy' in t.lower(): return 'SYMPY_ERROR'
    return 'UNKNOWN'

def make_error(exc):
    """Returnerer et struktureret JSON-fejlobjekt."""
    return json.dumps({
        'type':    'error',
        'code':    classify_error(exc),
        'message': str(exc),
        'raw':     type(exc).__name__,
    })

# ── 5. Resultat-indpakning ───────────────────────────────────────────────────
# decimal er ALTID en numerisk streng — aldrig en brøkstreng som "1/2".

def wrap_result(res, source_code=None):
    try:
        if res is None:
            return json.dumps({'type': 'success'})

        # Tuple fra convert_to_unit: (numerisk_værdi, enhedsstreng)
        if isinstance(res, tuple) and len(res) == 2 and isinstance(res[0], (int, float)):
            value, unit_str = res
            return json.dumps({
                'type':    'scalar',
                'latex':   f"{value} \\, \\text{{{unit_str}}}",
                'decimal': str(value),
            })

        # Liste af SymPy-udtryk (fx løsninger fra solve)
        if isinstance(res, (list, tuple)):
            return json.dumps({
                'type':    'list',
                'latex':   ', '.join(latex(simplify(r)) for r in res),
                'decimal': ', '.join(str(N(r)) for r in res),
            })

        # Pythons int/float og SymPy Integer/Rational/Float
        if isinstance(res, (int, float, Integer, Float, Rational)):
            f = float(res)
            if f == int(f):
                v = int(f)
                return json.dumps({'type': 'scalar', 'latex': str(v), 'decimal': str(v)})
            return json.dumps({
                'type':    'scalar',
                'latex':   latex(res if isinstance(res, Basic) else Rational(res).limit_denominator(10000)),
                'decimal': str(f),
            })

        # Symbolsk SymPy-udtryk
        simplified = simplify(res)
        try:
            f = float(simplified)
            if f == int(f):
                simplified = Integer(int(f))
        except (TypeError, ValueError):
            pass  # Udtryk har frie symboler — behold symbolsk form

        # Detektér komplekse resultater uden frie symboler.
        # SymPy kaster ikke fejl ved asin(2) eller sqrt(-4) — det returnerer
        # blot et komplekst tal. Vi advarer eleven frem for at vise et tal med 'I'.
        free = getattr(simplified, 'free_symbols', set())
        if not free and simplified.is_real is False:
            return json.dumps({
                'type':   'warning',
                'code':   'COMPLEX_RESULT',
                'latex':  latex(simplified),
                'decimal': str(N(simplified)),
                'source': source_code or '',
            })

        return json.dumps({
            'type':        'scalar',
            'latex':       latex(simplified),
            'decimal':     str(N(simplified)),
            'is_symbolic': bool(getattr(simplified, 'free_symbols', False)),
        })

    except Exception as exc:
        return make_error(exc)

# ── 6. Enheder ───────────────────────────────────────────────────────────────

UNITS = {
    # Tid
    's':  second,          'ms': milli * second,                   'h': hour,
    # Længde
    'm':  meter,           'mm': milli * meter,   'cm': centi * meter,
    'dm': deci * meter,    'km': kilo  * meter,
    # Masse
    'g':  gram,            'mg': milli * gram,    'kg': kilogram,
    # Kraft / energi / effekt
    'N':  newton,          'J':  joule,            'kJ': kilo * joule,
    'MJ': mega * joule,    'W':  watt,             'kW': kilo * watt,
    'kWh': 3_600_000 * joule,
    # Tryk
    'Pa': pascal,          'hPa': 100 * pascal,   'bar': bar,
    # El
    'A':  ampere,          'mA': milli * ampere,
    'V':  volt,            'kV': kilo  * volt,
    'C':  coulomb,         'Ohm': ohm,
    # Temperatur
    'K':      kelvin,
    'degC':   degree_Celsius,
    'deltaC': kelvin,
}

def integrate_cas(*args):
    """
    Wrapper der håndterer både ubestemt og bestemt integral:
      integrate(expr, var)          → ubestemt ∫ expr d(var)
      integrate(expr, var, a, b)    → bestemt  ∫[a,b] expr d(var)
    SymPy kræver (expr, (var, a, b)) for bestemte integraler.
    """
    if len(args) == 4:
        expr, var, lower, upper = args
        return integrate(expr, (var, lower, upper))
    return integrate(*args)

def arclength(expr, var, lower, upper):
    """
    Beregner kurvelængden af y = expr fra var=lower til var=upper.
    Formlen: ∫[a,b] √(1 + (dy/dx)²) dx
    
    Eksempel: arclength(x^2, x, 0, 1) ≈ 1.4789
    """
    derivative = diff(expr, var)
    integrand  = sqrt(1 + derivative**2)
    return integrate(integrand, (var, lower, upper))

def convert_to_unit(expr, target_unit_str):
    """
    Konverterer expr til target-enheden.
    target_unit_str er allerede renset for [] og ^ → ** af transformer.js.
    """
    try:
        import sympy.physics.units as _spu
        eval_ctx = {**vars(_spu), **UNITS}
        target_unit = eval(target_unit_str, eval_ctx)
        factor = float(N((expr / target_unit).simplify()))
        return (factor, str(target_unit))
    except Exception:
        return expr  # Konvertering mislykkedes — returner uændret

# ── 7. base_context ──────────────────────────────────────────────────────────
# Bygges i trin så rækkefølge og prioritet er eksplicit:
#   ① SymPy-funktioner
#   ② Egne funktioner (overstyrer konflikter fra ①)
#   ③ Enheder, konstanter og matematiske konstanter

base_context = {
    # ① Callable navne fra SymPy (solve, factor, diff, latex, N ...)
    name: obj
    for name, obj in vars(sympy_module).items()
    if callable(obj)
}

base_context.update({
    # ② Egne funktioner — overstyrer evt. konflikter
    'mean':            mean,
    'median':          median,
    'Q1':              Q1,
    'Q3':              Q3,
    'min':             min_func,
    'max':             max_func,
    'wrap_result':     wrap_result,
    'integrate':       integrate_cas,
    'arclength':       arclength,   # overstyrer SymPy's integrate
    'convert_to_unit': convert_to_unit,
    'convert_to':      convert_to,
})

base_context.update({
    # ③ Enheder, fysiske konstanter og matematiske konstanter
    **UNITS,
    'g':       9.82 * meter / second**2,
    'h_planck': planck,
    'minute':  minute,  # Eksplicit alias: eleverne kan skrive [minute] som enhed

    # Matematiske konstanter: ikke callable → mangler i ①
    'pi':  sympy_module.pi,
    'E':   sympy_module.E,
    'I':   sympy_module.I,
    'oo':  sympy_module.oo,
    'zoo': sympy_module.zoo,
    'nan': sympy_module.nan,

    # min og max er defineret i ② og overstyres ikke længere af UNITS.
})

# ── 8. Scope-registry ────────────────────────────────────────────────────────

task_registry = {}

FORBIDDEN_SYMBOLS = frozenset({
    'solve', 'factor', 'expand', 'simplify', 'diff', 'integrate',
    'Eq', 'Lambda', 'sqrt', 'log', 'exp', 'integrate', 'arclength',
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
    'asin', 'acos', 'atan', 'acot', 'asec', 'acsc',
    'Matrix', 'symbols', 'Symbol', 'N', 'latex',
    'mean', 'median', 'Q1', 'Q3', 'min', 'max',
    'wrap_result', 'convert_to_unit', 'convert_to',
    'pi', 'E', 'I', 'oo', 'zoo', 'nan',
})

# Matcher "navn = udtryk" men ikke ==, >=, <=
_ASSIGNMENT_RE = regex_module.compile(r'^[A-Za-z_]\w*\s*=(?![=<>])')

def run_in_task(task_id, code):
    """
    Eksekverer Python-kode i det scope der hører til task_id.
    Opretter automatisk SymPy-symboler for udefinerede navne.
    Returnerer JSON (wrap_result-format eller fejlobjekt).
    """
    if task_id not in task_registry:
        task_registry[task_id] = {}

    locs  = task_registry[task_id]
    globs = base_context

    try:
        for _ in range(10):
            try:
                exec(code, globs, locs)
                break
            except NameError as exc:
                m = regex_module.search(r"name '(.+)' is not defined", str(exc))
                if m and m.group(1) not in FORBIDDEN_SYMBOLS:
                    locs[m.group(1)] = Symbol(m.group(1))
                else:
                    raise

        lines = [l for l in code.strip().split('\n')
                 if l.strip() and not l.strip().startswith('#')]
        if not lines:
            return json.dumps({'type': 'success'})

        last = lines[-1]

        if _ASSIGNMENT_RE.match(last.strip()):
            return json.dumps({'type': 'success'})

        try:
            return wrap_result(eval(last, globs, locs), source_code=last)
        except SyntaxError:
            return json.dumps({'type': 'success'})

    except Exception as exc:
        return make_error(exc)
