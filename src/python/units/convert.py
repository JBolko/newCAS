import sympy as sp
import sympy.physics.units as spu
from typing import Union, Tuple
from .definitions import UNITS

def convert_to_unit(expr: sp.Basic, target_unit_str: str) -> Union[Tuple[float, str], sp.Basic]:
    """
    Konverterer expr til target-enheden.
    target_unit_str er allerede renset for [] og ^ → ** af transformer.js.
    Fallback til original expr ved fejl (matcher setup.py's robusthed).
    """
    try:
        eval_ctx = {**vars(spu), **UNITS}
        target_unit = eval(target_unit_str, eval_ctx)
        factor = float(sp.N((expr / target_unit).simplify()))
        return (factor, str(target_unit))
    except Exception:
        return expr