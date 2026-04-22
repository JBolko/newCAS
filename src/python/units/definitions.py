import sympy as sp
import sympy.physics.units as spu

degree_Celsius = getattr(spu, 'degree_Celsius',
                         getattr(spu, 'Celsius',
                                 getattr(spu, 'degC', spu.kelvin)))

UNITS: dict[str, sp.Basic] = {
    's': spu.second, 'ms': spu.milli * spu.second, 'h': spu.hour,
    'm': spu.meter, 'mm': spu.milli * spu.meter, 'cm': spu.centi * spu.meter,
    'dm': spu.deci * spu.meter, 'km': spu.kilo * spu.meter,
    'g': spu.gram, 'mg': spu.milli * spu.gram, 'kg': spu.kilogram,
    'N': spu.newton, 'J': spu.joule, 'kJ': spu.kilo * spu.joule,
    'MJ': spu.mega * spu.joule, 'W': spu.watt, 'kW': spu.kilo * spu.watt,
    'kWh': 3_600_000 * spu.joule,
    'Pa': spu.pascal, 'hPa': 100 * spu.pascal, 'bar': spu.bar,
    'A': spu.ampere, 'mA': spu.milli * spu.ampere,
    'V': spu.volt, 'kV': spu.kilo * spu.volt,
    'C': spu.coulomb, 'Ohm': spu.ohm,
    'K': spu.kelvin, 'degC': degree_Celsius, 'deltaC': spu.kelvin,
}