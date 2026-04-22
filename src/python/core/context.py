# core/context.py
import sympy as sp
import sympy.physics.units as spu
from typing import Dict, Any, Tuple, Set
from cas_math.registry import build_context
from units.definitions import UNITS
from units.convert import convert_to_unit

# ⚠️ Disse imports eksekverer @register-decoratorerne
import cas_math.statistics
import cas_math.calculus

def build_base_context() -> Tuple[Dict[str, Any], frozenset]:
    """
    Konstruerer CAS-engineens base-namespace.
    Prioritet: SymPy builtins < Registry functions < Units/Constants
    """
    ctx: Dict[str, Any] = {}

    # ① SymPy callables
    for name, obj in vars(sp).items():
        if callable(obj):
            ctx[name] = obj

    # ② Registry functions (overskriver evt. sympy-navne)
    reg_ctx, _ = build_context()
    ctx.update(reg_ctx)

    # ③ Enheder
    ctx.update(UNITS)

    # ④ Konstanter & ekstra utils
    ctx.update({
        'g': 9.82 * spu.meter / spu.second**2,
        'h_planck': getattr(spu, 'planck', sp.Symbol('planck')),
        'minute': getattr(spu, 'minute', sp.Symbol('minute')),
        'pi': sp.pi, 'E': sp.E, 'I': sp.I,
        'oo': sp.oo, 'zoo': sp.zoo, 'nan': sp.nan,
        'convert_to': spu.convert_to,
        'convert_to_unit': convert_to_unit,
    })

    # Sikr at vores min/max ikke overskrives
    if 'min' in reg_ctx: ctx['min'] = reg_ctx['min']
    if 'max' in reg_ctx: ctx['max'] = reg_ctx['max']

    # ─── ANGLE MODE SUPPORT (KOMPLET) ───────────────────────────────────
    import __main__
    angle_mode = getattr(__main__, 'ANGLE_MODE', 'deg')
    
    if angle_mode == 'deg':
        # Forward trig: konverter KUN numeriske argumenter fra grader til radianer
        # Symbolske udtryk (f.eks. sin(x)) forbliver i radianer → nødvendigt for calculus
        def _deg_aware(func):
            def wrapper(arg):
                if isinstance(arg, (int, float, sp.Integer, sp.Float, sp.Rational)):
                    return func(arg * sp.pi / 180)
                return func(arg)
            wrapper.__name__ = func.__name__
            return wrapper

        ctx['sin']  = _deg_aware(sp.sin)
        ctx['cos']  = _deg_aware(sp.cos)
        ctx['tan']  = _deg_aware(sp.tan)
        ctx['sec']  = _deg_aware(lambda x: 1/sp.cos(x))
        ctx['csc']  = _deg_aware(lambda x: 1/sp.sin(x))
        ctx['cot']  = _deg_aware(lambda x: sp.cos(x)/sp.sin(x))
        
        # Inverse trig: SymPy returnerer radianer → konverter altid resultatet til grader
        def _arc_deg_aware(func):
            def wrapper(arg):
                return func(arg) * 180 / sp.pi
            wrapper.__name__ = func.__name__
            return wrapper

        ctx['asin'] = _arc_deg_aware(sp.asin)
        ctx['acos'] = _arc_deg_aware(sp.acos)
        ctx['atan'] = _arc_deg_aware(sp.atan)
        ctx['acot'] = _arc_deg_aware(sp.acot)
        ctx['asec'] = _arc_deg_aware(sp.asec)
        ctx['acsc'] = _arc_deg_aware(sp.acsc)
    # ─────────────────────────────────────────────────────────────────────
    
    # Gør ALLE nøgler forbudte at redefinere (sikkerhedsmodel)
    return ctx, frozenset(ctx.keys())