import json
import sympy as sp
from sympy import latex, simplify, N, Integer, Float, Rational, Basic
from typing import Any, Optional
from .errors import make_error

def wrap_result(res: Any, source_code: Optional[str] = None) -> str:
    """
    Indpakker CAS-resultat i det JSON-format frontend'en forventer.
    Matcher præcis logikken fra den originale setup.py.
    """
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
            if f == int(f) and abs(f) < 1e15:
                v = int(f)
                return json.dumps({'type': 'scalar', 'latex': str(v), 'decimal': f"{v}.0"})

            # Rene Python-floats (fx fra distributions: binompdf → 0.2335)
            # vises som decimal, ikke som brøk. Brøker er uegnede til sandsynligheder.
            if type(res) is float:
                # Vis op til 6 signifikante cifre — afskær trailing zeros
                latex_str = f"{f:.6g}".replace('.', '{,}')
                return json.dumps({
                    'type':    'scalar',
                    'latex':   latex_str,
                    'decimal': str(f),
                })

            # SymPy-tal (Integer, Rational, Float) → LaTeX via SymPy
            return json.dumps({
                'type':    'scalar',
                'latex':   latex(res if isinstance(res, Basic)
                                 else Rational(res).limit_denominator(10000)),
                'decimal': str(f),
            })

        # Hypotesetest-resultat — videresendes direkte
        if isinstance(res, dict) and res.get('type') == 'hypothesis_test':
            return json.dumps(res)

        # Regression-resultat — returneres som-er (FØR simplify!)
        if isinstance(res, dict) and res.get('type') == 'regression':
            return json.dumps(res)

        # Symbolsk SymPy-udtryk
        simplified = simplify(res)
        
        # Uendelige værdier
        if getattr(simplified, 'is_infinite', False):
            # zoo = kompleks uendelighed (log(0), tan(π/2)) → domænefejl
            if simplified == sp.zoo:
                return json.dumps({
                    'type':   'warning',
                    'code':   'COMPLEX_RESULT',
                    'latex':  latex(simplified),
                    'decimal': str(simplified),
                    'source': source_code or '',
                })
            # oo / -oo = reel uendelighed (grænseværdi) → scalar
            return json.dumps({
                'type':        'scalar',
                'latex':       latex(simplified),
                'decimal':     str(simplified),
                'is_symbolic': False,
            })

        try:
            f = float(simplified)
            if f == int(f):
                simplified = Integer(int(f))
        except (TypeError, ValueError, OverflowError):
            pass  # Symbolsk eller ikke-konverterbart

        # Detektér komplekse resultater uden frie symboler
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
            'is_symbolic': bool(free),
        })

    except Exception as exc:
        return make_error(exc)