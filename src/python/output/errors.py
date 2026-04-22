import json
from typing import Dict, Any

def classify_error(exc: Exception) -> str:
    """Returnerer en maskinlæsbar fejlkode som JS oversætter til dansk."""
    t = type(exc).__name__
    s = str(exc)

    if isinstance(exc, ZeroDivisionError): return 'ZERO_DIVISION'
    if isinstance(exc, RecursionError):    return 'RECURSION'
    if isinstance(exc, OverflowError):     return 'OVERFLOW'
    if isinstance(exc, NameError):         return 'UNDEFINED_NAME'
    if isinstance(exc, TypeError):         return 'TYPE_ERROR'
    if 'NonInvertibleMatrix' in t:         return 'SINGULAR_MATRIX'
    if 'NonSquareMatrix' in t:             return 'NON_SQUARE_MATRIX'
    if 'sympy' in s.lower() or 'sympy' in t.lower(): return 'SYMPY_ERROR'
    return 'UNKNOWN'

def make_error(exc: Exception) -> str:
    """Returnerer et struktureret JSON-fejlobjekt."""
    return json.dumps({
        'type':    'error',
        'code':    classify_error(exc),
        'message': str(exc),
        'raw':     type(exc).__name__,
    })