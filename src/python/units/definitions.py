"""
Enhedsdefinitioner — SymPy physics.units + custom
"""

import sympy.physics.units as spu
from sympy.physics.units import Quantity

# Custom enheder
celsius = Quantity("celsius")
milliampere = spu.ampere / 1000

UNITS = {
    # Længde
    'm': spu.meter,
    'meter': spu.meter,
    'km': spu.kilometer,
    'cm': spu.centimeter,
    'mm': spu.millimeter,
    
    # Tid
    's': spu.second,
    'second': spu.second,
    'minute': spu.minute,
    'min': spu.minute,
    'h': spu.hour,
    'hour': spu.hour,
    
    # Masse
    'kg': spu.kilogram,
    'gram': spu.gram,
    'g': spu.gram,
    'mg': spu.milligram,
    
    # Temperatur
    'K': spu.kelvin,
    'kelvin': spu.kelvin,
    'C': celsius,
    'celsius': celsius,
    
    # Kraft
    'N': spu.newton,
    'newton': spu.newton,
    
    # Energi
    'J': spu.joule,
    'joule': spu.joule,
    
    # Effekt
    'W': spu.watt,
    'watt': spu.watt,
    
    # Tryk
    'Pa': spu.pascal,
    'pascal': spu.pascal,
    'bar': 100000*spu.pascal,
    
    # Elektrisk
    'A': spu.ampere,
    'ampere': spu.ampere,
    'mA': milliampere,
    'milliampere': milliampere,
    
    # Hastighed
    'm/s': spu.meter / spu.second,
    'km/h': spu.kilometer / spu.hour,
}
