from typing import Callable, Any, Dict, Tuple, Set

_REGISTRY: Dict[str, Tuple[Callable, Dict[str, Any]]] = {}

def register(name: str, forbidden: bool = False, category: str = "general") -> Callable:
    """
    Decorator til registrering af CAS-funktioner i det globale namespace.
    forbidden=True markerer funktioner som eleverne ikke må redefinere.
    """
    def decorator(func: Callable) -> Callable:
        _REGISTRY[name] = (func, {"forbidden": forbidden, "category": category})
        return func
    return decorator

def build_context() -> Tuple[Dict[str, Any], Set[str]]:
    """Bygger context-dict og forbidden-set fra registret."""
    ctx: Dict[str, Any] = {}
    forbidden: Set[str] = set()
    for name, (func, meta) in _REGISTRY.items():
        ctx[name] = func
        if meta.get("forbidden", False):
            forbidden.add(name)
    return ctx, forbidden