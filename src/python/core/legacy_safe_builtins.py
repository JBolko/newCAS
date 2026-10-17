"""Explicitly bounded builtins for the retiring source-to-Python engine.

This is NOT a Python sandbox. It prevents implicit name lookup of powerful
CPython builtins from generated code while the legacy engine is being retired.
The attested Semantic IR / selected evaluator must never import this module.
"""

from types import MappingProxyType

# Preserve elementary legacy CAS calls without exposing introspection, IO,
# dynamic execution or imports. No ambient __import__, open, eval or exec.
LEGACY_SAFE_BUILTINS = MappingProxyType({
    'abs': abs,
    'complex': complex,
    'float': float,
    'int': int,
    'len': len,
    'max': max,
    'min': min,
    'round': round,
    'sum': sum,
})
