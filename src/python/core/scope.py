# core/scope.py
from typing import Dict, Any, Set
import re
import sympy as sp

# Globalt task-scope (lever mellem kald i samme session)
task_registry: Dict[str, Dict[str, Any]] = {}

# Regex til at udpakke navnet fra NameError-exceptions
_NAME_ERROR_RE = re.compile(r"name '([^']+)' is not defined")

def execute_with_auto_symbols(code: str, globs: Dict[str, Any], locs: Dict[str, Any], forbidden: Set[str]) -> None:
    """
    Eksekverer kode og injicerer automatisk sympy.Symbol for udefinerede navne.
    Matcher den oprindelige 10-gange retry-logik, men isoleret her for renhed.
    """
    for _ in range(10):
        try:
            exec(code, globs, locs)
            return
        except NameError as exc:
            m = _NAME_ERROR_RE.search(str(exc))
            if m:
                name = m.group(1)
                if name not in forbidden:
                    locs[name] = sp.Symbol(name)
                else:
                    raise
            else:
                raise
    raise RuntimeError("Max symbol resolution attempts exceeded for code block.")