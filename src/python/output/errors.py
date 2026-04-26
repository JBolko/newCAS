"""
Fejl-klassificering og formatering
"""

import json

ERROR_CODE_PYTHON = "PYTHON_ERROR"
ERROR_CODE_UNDEFINED = "UNDEFINED_NAME"
ERROR_CODE_COMPLEX = "COMPLEX_RESULT"
ERROR_CODE_DOMAIN = "DOMAIN_ERROR"
ERROR_CODE_ZERO_DIV = "ZERO_DIVISION"

def make_error(exc_or_code, message=None, raw=None):
    """
    Bygger standardiseret fejl-objekt.
    Kan kaldes som:
      make_error(exception) — klassificerer exception
      make_error('ZERO_DIVISION', 'Division med nul') — eksplicit
    """
    if isinstance(exc_or_code, Exception):
        exc = exc_or_code
        exc_str = str(exc)
        exc_type = type(exc).__name__
        
        # Klassificer fejlen
        if isinstance(exc, ZeroDivisionError):
            code = ERROR_CODE_ZERO_DIV
            msg = "Division med nul"
        elif isinstance(exc, NameError):
            code = ERROR_CODE_UNDEFINED
            msg = exc_str
        elif isinstance(exc, RecursionError):
            code = ERROR_CODE_PYTHON
            msg = "Rekursionslimit nået"
        elif isinstance(exc, OverflowError):
            code = ERROR_CODE_PYTHON
            msg = "Tal for stort"
        elif isinstance(exc, TypeError):
            code = ERROR_CODE_PYTHON
            msg = "Type-fejl i beregning"
        else:
            code = ERROR_CODE_PYTHON
            msg = f"{exc_type}: {exc_str[:100]}"
        
        return json.dumps({
            'type': 'error',
            'code': code,
            'message': msg,
            'raw': exc_str
        })
    else:
        # Eksplicit kald: make_error(code, message, raw)
        code = exc_or_code
        msg = message or "Ukendt fejl"
        r = raw or ""
        return json.dumps({
            'type': 'error',
            'code': code,
            'message': msg,
            'raw': r
        })
