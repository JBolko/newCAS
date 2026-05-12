"""
Enhedskonvertering via SymPy
"""

import sympy.physics.units as spu

def convert_to_unit(value_with_unit, target_unit_str):
    """
    Konverterer en værdi med enhed til en anden enhed.
    Returnerer resultatet som numerisk værdi hvis muligt.
    """
    # Hent target-enhed
    try:
        target_unit = getattr(spu, target_unit_str.strip())
    except AttributeError:
        from units.definitions import UNITS
        target_unit = UNITS.get(target_unit_str.strip())
        if not target_unit:
            raise ValueError(f"Ukendt enhed: {target_unit_str}")
    
    # SymPy's convert_to
    result = spu.convert_to(value_with_unit, target_unit)
    
    # Uddrag koefficienten (tallet uden enhed)
    # Hvis result er f.eks. "1*ampere", koeff(ampere) = 1
    coeff = result.coeff(target_unit)
    if coeff is not None:
        # Vi har et tal uden enhed
        return coeff
    
    # Fallback: returnér hele resultatet
    return result
