"""
Task-scope og auto-symbol-injektion
"""

from typing import Dict, Any, Set
import re
import sympy as sp
from .legacy_safe_builtins import LEGACY_SAFE_BUILTINS

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
            # A document writer named __builtins__ must not overwrite the
            # trusted namespace when the task scope is merged into globals.
            combined["__builtins__"] = LEGACY_SAFE_BUILTINS
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

def reset_task(task_id: str) -> None:
    """
    Fjerner den materialiserede runtime-state for ét task-scope.

    Task-scope er afledt state. Efter reset oprettes scope igen
    af run_in_task(), når tasken næste gang eksekveres.
    """
    task_registry.pop(task_id, None)
    
def get_task_state(task_id: str) -> dict:
    """
    Returnerer et serialiserbart snapshot af brugerdefinerede navne
    i et task-scope.

    Funktionen eksponerer ikke selve scope-dictionary'en og returnerer
    ingen Python/SymPy-objekter direkte.
    """
    scope = task_registry.get(task_id, {})

    variables = []

    for name, value in sorted(scope.items()):
        # Funktionsdefinitioner håndteres senere som en separat kontrakt.
        if callable(value):
            continue

        variables.append({
            "name": name,
            "expr": str(value),
        })

    return {
        "type": "scope",
        "task_id": task_id,
        "variables": variables,
    }
