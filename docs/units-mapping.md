# Enhedshåndtering og Mapping

## Syntaks
Enheder angives i kantede parenteser efter en numerisk værdi: `Værdi [Enhed]`.
Parseren genkender alt inden for `[...]` som en `Unit` streng.

## Mapping Strategi (Transformer -> SymPy)
For at SymPy kan regne med enheder, skal `transformer.js` konvertere enhedsstrenge til SymPy objekter.

### Regler for konvertering:
1. **Potenser:** `m/s^2` i input skal konverteres til `m/s**2` i Python.
2. **Præfikser:** Understøttelse af SI-præfikser (kilo, milli, etc.) skal mappes direkte til SymPy units modulet.

### Eksempler på Mapping:
| CAS Input | SymPy Notation (via parse_units) |
| :--- | :--- |
| `[m]` | `units.meter` |
| `[m/s]` | `units.meter / units.second` |
| `[kg*m/s^2]` | `units.kilogram * units.meter / units.second**2` |
| `[km/h]` | `units.kilometer / units.hour` |

## Implementeringsdetalje i Python
I `cas-engine.js` defineres en hjælpefunktion i Python-startscriptet:
```python
def parse_units(u_str):
    # Erstatter ^ med ** og mapper kendte enheder
    # Returnerer et SymPy Quantity objekt
    return eval(u_str.replace('^', '**'), {"__builtins__": None}, sympy_unit_dict)