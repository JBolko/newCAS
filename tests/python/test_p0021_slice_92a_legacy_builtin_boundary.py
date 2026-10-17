"""S92a: the retiring Python evaluator must not inherit ambient builtins."""

import unittest
import sys
from pathlib import Path

# The retired Pyodide bootstrap adds src/python as a top-level import root.
# Mirror only that import arrangement for this isolated unittest.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "python"))
from core.legacy_safe_builtins import LEGACY_SAFE_BUILTINS


class LegacyBuiltinBoundaryTests(unittest.TestCase):
    def test_explicit_small_immutable_allowlist(self):
        allowed = {'abs', 'complex', 'float', 'int', 'len', 'max', 'min', 'round', 'sum'}
        self.assertEqual(set(LEGACY_SAFE_BUILTINS), allowed)
        for prohibited in ('eval', 'exec', 'open', '__import__', 'compile', 'globals',
                           'locals', 'getattr', 'setattr', 'breakpoint', 'input', 'vars'):
            self.assertNotIn(prohibited, LEGACY_SAFE_BUILTINS)
        with self.assertRaises(TypeError):
            LEGACY_SAFE_BUILTINS['open'] = object()

    def test_builtins_are_present_in_every_base_context(self):
        from core.context import build_base_context
        a, _ = build_base_context()
        b, _ = build_base_context()
        self.assertIs(a['__builtins__'], LEGACY_SAFE_BUILTINS)
        self.assertIs(b['__builtins__'], LEGACY_SAFE_BUILTINS)
        self.assertTrue(callable(a['sin']))
        self.assertTrue(callable(a['sqrt']))

    def test_task_writer_cannot_shadow_builtin_namespace_on_exec(self):
        from core.context import build_base_context
        from core.scope import execute_with_auto_symbols
        from core.executor import ScopedGlobals
        base, forbidden = build_base_context()
        locs = {'__builtins__': {'open': object()}}
        globs = ScopedGlobals(base, locs)
        self.assertIs(globs['__builtins__'], LEGACY_SAFE_BUILTINS)
        self.assertIs(globs.get('__builtins__'), LEGACY_SAFE_BUILTINS)
        execute_with_auto_symbols('answer = abs(-7)', globs, locs, forbidden)
        self.assertEqual(locs['answer'], 7)
        self.assertIs(globs['__builtins__'], LEGACY_SAFE_BUILTINS)

    def test_ordinary_legacy_cas_operation_still_works(self):
        import json
        from core.executor import run_in_task
        from core.scope import reset_task
        task = 's92a-test'
        try:
            self.assertEqual(json.loads(run_in_task(task, 'a = 3'))['type'], 'success')
            output = json.loads(run_in_task(task, 'a + 2'))
            self.assertNotEqual(output['type'], 'error', output)
        finally:
            reset_task(task)

    def test_unregistered_globals_call_does_not_enter_python_builtins(self):
        # Harmless introspection probe: previously inherited from CPython.
        # Do not execute filesystem, import, or dynamic-evaluation payloads.
        import json
        from core.executor import run_in_task
        from core.scope import reset_task
        task = 's92a-denied-builtin'
        try:
            outcome = json.loads(run_in_task(task, 'probe = globals()'))
            self.assertEqual(outcome['type'], 'error', outcome)
        finally:
            reset_task(task)

    def test_selected_ir_does_not_depend_on_legacy_scope(self):
        from pathlib import Path
        root = Path(__file__).resolve().parents[2] / 'src' / 'python'
        for layer in ('evaluator', 'adapters'):
            for f in (root / layer).glob('*.py'):
                body = f.read_text(encoding='utf-8')
                for legacy in ('legacy_safe_builtins', 'core.scope', 'core.executor'):
                    self.assertNotIn(legacy, body, f'{f} imported retiring scope')


if __name__ == '__main__':
    unittest.main()
