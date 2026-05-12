"""
Task-scope og auto-symbol-injektion
"""

from typing import Dict, Any, Set
import re
import sympy as sp

task_registry: Dict[str, Dict[str, Any]] = {}
_NAME_ERROR_RE = re.compile(r"name '([^']+)' is not defined")

def execute_with_auto_symbols(code: str, globs: Dict[str, Any], locs: Dict[str, Any], forbidden: Set[str]) -> None:
    """
    Eksekverer kode med auto-symbol-injektion.
    Kun NameError bliver handled; andre exceptions kastes.
    """
    for attempt in range(10):
        try:
            combined = {**globs, **locs}
            exec(code, combined, locs)
            return
        except NameError as exc:
            m = _NAME_ERROR_RE.search(str(exc))
            if m:
                name = m.group(1)
                if name not in forbidden:
                    locs[name] = sp.Symbol(name)
                else:
                    raise ValueError(f"'{name}' er ikke defineret i denne kontekst.")
            else:
                raise
    raise RuntimeError("Max symbol resolution attempts exceeded for code block.")
