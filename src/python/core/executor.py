# core/executor.py
import ast
import json
import re
import sympy as sp
from typing import Optional
from .context import build_base_context
from .scope import task_registry, execute_with_auto_symbols, _NAME_ERROR_RE as _NAME_RE
from output.result import wrap_result
from output.errors import make_error

# Initialiser namespace KUN én gang ved modul-import
BASE_CONTEXT, FORBIDDEN_SYMBOLS = build_base_context()


class ScopedGlobals(dict):
    """
    Dict-subklasse der proxier task-scope (locs) over base_context (globs).
    Bruges som globals-argument til exec() så def-funktioner kan se variables
    fra task-scope selv efter de er defineret.
    
    Eksempel:
      exec("def f(t): return t**2 + b", ScopedGlobals(base, locs), locs)
      f.__globals__['b'] finder b i locs, ikke base.
    """
    def __init__(self, base: dict, task_scope: dict):
        super().__init__(base)
        self._task_scope = task_scope

    def __getitem__(self, key):
        if key in self._task_scope:
            return self._task_scope[key]
        return super().__getitem__(key)

    def __contains__(self, key):
        return key in self._task_scope or super().__contains__(key)

    def get(self, key, default=None):
        if key in self._task_scope:
            return self._task_scope[key]
        return super().get(key, default)


# ─── FEJL-KONSTANTER (TILPAS TIL DIN PAKKES STANDARDS) ─────────────
ERROR_CODE_UNDEFINED = "UNDEFINED_NAME"
# ────────────────────────────────────────────────────────────────────

def _is_assignment(code: str) -> bool:
    """Bruger AST til sikkert at detektere om et stykke kode er en tilordning."""
    try:
        tree = ast.parse(code.strip(), mode="exec")
        if not tree.body:
            return False
        last_stmt = tree.body[-1]
        return isinstance(last_stmt, (ast.Assign, ast.AugAssign, ast.AnnAssign))
    except SyntaxError:
        return False

def _preprocess_cas_syntax(code: str) -> str:
    """
    Fanger CAS-venlig syntax og gør det Python/SymPy-kompatibelt:
    - f(x) = x^2  →  f = lambda x: x**2
    - g(a,b) = a+b → g = lambda a,b: a+b
    """
    lines = code.strip().split('\n')
    processed = []
    for line in lines:
        stripped = line.strip()
        # Behold indrykning — kun top-level linjer preprocesses
        is_indented = line.startswith((' ', '\t'))
        if not stripped or stripped.startswith('#'):
            processed.append(stripped)
            continue
        if is_indented:
            # Indrykket linje (f.eks. 'return'-krop i def) — rør ikke
            processed.append(line)
            continue
        # Regex matcher top-level: navn(args) = højreside (CAS-syntaks)
        match = re.match(r'^([a-zA-Z_]\w*)\(([^)]*)\)\s*=\s*(.+)$', stripped)
        if match:
            func_name, args, rhs = match.groups()
            rhs_py = rhs.replace('^', '**')
            processed.append(f"{func_name} = lambda {args}: {rhs_py}")
        else:
            processed.append(stripped)
    return '\n'.join(processed)


def run_in_task(task_id: str, code: str) -> str:
    if task_id not in task_registry:
        task_registry[task_id] = {}
    locs = task_registry[task_id]
    # Brug ScopedGlobals så task-scope (locs) er synlig for def-funktioner
    globs = ScopedGlobals(BASE_CONTEXT, locs)

    try:
        # 🔹 1. FORARBEJD CAS-SYNTAX (f(x)=...)
        # Enkelt udefinerede variable håndteres af auto-symbol-mekanismen
        # i execute_with_auto_symbols — ikke som en fejl.
        processed_code = _preprocess_cas_syntax(code)

        # 🔹 2. EKSEKVER KODEN
        execute_with_auto_symbols(processed_code, globs, locs, FORBIDDEN_SYMBOLS)

        # Find sidste meningsfulde linje i den forarbejdede kode
        lines = [l for l in processed_code.strip().split('\n') 
                 if l.strip() and not l.strip().startswith('#')]
        if not lines:
            return json.dumps({'type': 'success'})

        last_line = lines[-1].strip()

        # Tilordninger returnerer altid success (ingen output forventet)
        if _is_assignment(last_line):
            return json.dumps({'type': 'success'})

        # Evaluer sidste linje og formatér resultat.
        # eval() har sin egen auto-symbol-retry fordi NameError kan opstå
        # her (fx b i f(t) := t^2 + b — b kendes først ved kaldstidspunkt).
        try:
            for _ in range(10):
                try:
                    result = eval(last_line, globs, locs)
                    return wrap_result(result, source_code=last_line)
                except NameError as exc:
                    m = _NAME_RE.search(str(exc))
                    if m and m.group(1) not in FORBIDDEN_SYMBOLS:
                        locs[m.group(1)] = sp.Symbol(m.group(1))
                    else:
                        raise
            raise RuntimeError("Max eval attempts exceeded")
        except SyntaxError:
            return json.dumps({'type': 'success'})

    except Exception as exc:
        return make_error(exc)