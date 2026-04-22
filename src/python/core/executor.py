# core/executor.py
import ast
import json
import re
import sympy as sp
from typing import Optional
from .context import build_base_context
from .scope import task_registry, execute_with_auto_symbols
from output.result import wrap_result
from output.errors import make_error

# Initialiser namespace KUN én gang ved modul-import
BASE_CONTEXT, FORBIDDEN_SYMBOLS = build_base_context()

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
    globs = BASE_CONTEXT

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

        # Evaluer sidste linje og formatér resultat
        try:
            result = eval(last_line, globs, locs)
            return wrap_result(result, source_code=last_line)
        except SyntaxError:
            return json.dumps({'type': 'success'})

    except Exception as exc:
        return make_error(exc)