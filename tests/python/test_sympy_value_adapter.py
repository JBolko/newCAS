"""P0011 permanent SymPy Value-adapter contract tests.

Consolidated from the five pressure slices. No behavior or assertions changed.
"""
"""P0011 Slice 1: candidate adapter boundary, deliberately RED until implemented.

Run from repo root: python -m unittest discover -s tests/python -p "test_p0011_*.py" -v
Requires the pinned SymPy backend on the Python path.
"""
import unittest
import sympy as sp


def slice1_free(task, name="x"):
    return {"identityVersion": 1, "kind": "free-symbol",
            "taskScopeId": task, "name": name}


def slice1_binder(identifier, name="x"):
    return {"identityVersion": 1, "kind": "binder",
            "id": identifier, "displayName": name}


def slice1_local(identifier, name="x"):
    return {"identityVersion": 1, "kind": "operation-local",
            "id": identifier, "displayName": name}


def slice1_symbol(identity):
    return {"valueVersion": 1, "kind": "expression",
            "data": {"expr": {"op": "symbolRef", "identity": identity}}}


def slice1_adapter():
    # Candidate interface only. P0011 must justify API before GREEN.
    from src.python.adapters.sympy_value_adapter import SympyValueAdapter
    return SympyValueAdapter()


class IdentityBridgePressure(unittest.TestCase):
    def test_distinct_categories_same_display_name_do_not_alias(self):
        a = slice1_adapter()
        symbols = [a.to_backend(slice1_symbol(i)) for i in (
            slice1_free("task-1"), slice1_binder("binder:1"), slice1_local("op:1"))]
        self.assertEqual(len(set(symbols)), 3)
        for left in symbols:
            for right in symbols:
                if left is not right:
                    self.assertNotEqual(left, right)

    def test_free_symbol_same_identity_reuses_backend_symbol(self):
        a = slice1_adapter()
        left = a.to_backend(slice1_symbol(slice1_free("task-1")))
        right = a.to_backend(slice1_symbol(slice1_free("task-1")))
        self.assertEqual(left, right)

    def test_equal_spellings_across_tasks_remain_distinct(self):
        a = slice1_adapter()
        left = a.to_backend(slice1_symbol(slice1_free("task-1")))
        right = a.to_backend(slice1_symbol(slice1_free("task-2")))
        self.assertNotEqual(left, right)

    def test_backend_substitution_cannot_capture_other_identity(self):
        a = slice1_adapter()
        free_x = a.to_backend(slice1_symbol(slice1_free("task-1")))
        bound_x = a.to_backend(slice1_symbol(slice1_binder("binder:1")))
        expression = free_x + bound_x
        substituted = expression.subs(bound_x, sp.Integer(7))
        self.assertEqual(substituted, free_x + 7)
        self.assertIn(free_x, substituted.free_symbols)

    def test_roundtrip_preserves_both_semantic_identities(self):
        a = slice1_adapter()
        free_value = slice1_symbol(slice1_free("task-1"))
        bound_value = slice1_symbol(slice1_binder("binder:1"))
        self.assertEqual(a.from_backend(a.to_backend(free_value)), free_value)
        self.assertEqual(a.from_backend(a.to_backend(bound_value)), bound_value)

    def test_backend_state_can_be_discarded_without_public_identity_loss(self):
        value = slice1_symbol(slice1_local("op:integral:1"))
        first = slice1_adapter()
        self.assertEqual(first.from_backend(first.to_backend(value)), value)
        second = slice1_adapter()
        self.assertEqual(second.from_backend(second.to_backend(value)), value)



"""P0011 Slice 2: RED pressure on composite expressions and exactness.

Run: python -m unittest discover -s tests/python -p 'test_p0011_*.py' -v
"""
import unittest
import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter


def slice2_expression(node):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}


def slice2_integer(n):
    return {'op': 'integer', 'value': str(n)}


def slice2_rational(p, q):
    return {'op': 'rational', 'numerator': str(p), 'denominator': str(q)}


def slice2_symbol(identity):
    return {'op': 'symbolRef', 'identity': identity}


def slice2_free(scope, name='x'):
    return {'identityVersion': 1, 'kind': 'free-symbol', 'taskScopeId': scope, 'name': name}


def slice2_binder(identifier, name='x'):
    return {'identityVersion': 1, 'kind': 'binder', 'id': identifier, 'displayName': name}


class CompositeExpressionPressure(unittest.TestCase):
    def test_integer_converts_exactly_and_roundtrips(self):
        adapter = SympyValueAdapter()
        value = slice2_expression(slice2_integer('123456789012345678901234567890'))
        backend = adapter.to_backend(value)
        self.assertEqual(backend, sp.Integer('123456789012345678901234567890'))
        self.assertEqual(adapter.from_backend(backend), value)

    def test_rational_stays_exact(self):
        adapter = SympyValueAdapter()
        value = slice2_expression(slice2_rational(1, 3))
        backend = adapter.to_backend(value)
        self.assertEqual(backend, sp.Rational(1, 3))
        self.assertTrue(backend.is_Rational)
        self.assertEqual(adapter.from_backend(backend), value)

    def test_add_and_mul_use_distinct_identities_despite_same_spelling(self):
        adapter = SympyValueAdapter()
        a, b = slice2_free('task-1'), slice2_binder('binder:1')
        expr = slice2_expression({'op': 'add', 'args': [
            {'op': 'mul', 'args': [slice2_integer(2), slice2_symbol(a)]},
            {'op': 'mul', 'args': [slice2_integer(3), slice2_symbol(b)]},
        ]})
        backend = adapter.to_backend(expr)
        self.assertEqual(len(backend.free_symbols), 2)
        free_x = adapter.to_backend(slice2_expression(slice2_symbol(a)))
        bound_x = adapter.to_backend(slice2_expression(slice2_symbol(b)))
        self.assertEqual(backend.subs(bound_x, 0), 2 * free_x)
        self.assertEqual(backend.subs(free_x, 0), 3 * bound_x)

    def test_pow_is_converted_without_float_coercion(self):
        adapter = SympyValueAdapter()
        expr = slice2_expression({'op': 'pow', 'base': slice2_integer(2), 'exponent': slice2_integer(100)})
        result = adapter.to_backend(expr)
        self.assertEqual(result, sp.Integer(2) ** 100)
        self.assertTrue(result.is_Integer)

    def test_sympy_canonicalizes_expression_without_losing_public_meaning(self):
        adapter = SympyValueAdapter()
        # Literal structural roundtrip is not required: SymPy may simplify.
        expr = slice2_expression({'op': 'add', 'args': [slice2_integer(1), slice2_rational(1, 2)]})
        result = adapter.to_backend(expr)
        self.assertEqual(result, sp.Rational(3, 2))
        public = adapter.from_backend(result)
        self.assertEqual(adapter.to_backend(public), result)
        self.assertEqual(public['data']['expr']['op'], 'rational')

    def test_approximate_input_is_not_silently_recast_as_exact(self):
        adapter = SympyValueAdapter()
        expr = slice2_expression({'op': 'approx', 'value': '0.125'})
        result = adapter.to_backend(expr)
        self.assertIsInstance(result, sp.Float)
        public = adapter.from_backend(result)
        self.assertEqual(public['data']['expr']['op'], 'approx')
        self.assertEqual(adapter.to_backend(public), result)



"""P0011 Slice 3: backend-originated symbol authority pressure."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter


def slice3_symbol_value(kind='free-symbol', key='task-A', name='x'):
    if kind == 'free-symbol':
        identity = {'identityVersion': 1, 'kind': kind, 'taskScopeId': key, 'name': name}
    else:
        identity = {'identityVersion': 1, 'kind': kind, 'id': key, 'displayName': name}
    return {'valueVersion': 1, 'kind': 'expression',
            'data': {'expr': {'op': 'symbolRef', 'identity': identity}}}


class ForeignSymbolPressure(unittest.TestCase):
    def setUp(self):
        self.adapter = SympyValueAdapter()
        self.public_x = slice3_symbol_value()
        self.owned_x = self.adapter.to_backend(self.public_x)

    def test_plain_sympy_symbol_cannot_acquire_identity_from_spelling(self):
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            self.adapter.from_backend(sp.Symbol('x'))

    def test_foreign_dummy_same_spelling_is_not_registered(self):
        foreign = sp.Dummy('x')
        self.assertNotEqual(foreign, self.owned_x)
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            self.adapter.from_backend(foreign)

    def test_foreign_symbol_inside_add_is_not_silently_adopted(self):
        expr = self.owned_x + sp.Symbol('y')
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            self.adapter.from_backend(expr)

    def test_foreign_symbol_inside_pow_is_not_silently_adopted(self):
        expr = (self.owned_x + sp.Dummy('x')) ** 2
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            self.adapter.from_backend(expr)

    def test_symbols_do_not_leak_between_disposable_adapters(self):
        second = SympyValueAdapter()
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            second.from_backend(self.owned_x)
        self.assertEqual(second.from_backend(second.to_backend(self.public_x)), self.public_x)

    def test_foreign_symbol_failure_does_not_poison_existing_mapping(self):
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            self.adapter.from_backend(self.owned_x + sp.Symbol('x'))
        self.assertEqual(self.adapter.from_backend(self.owned_x), self.public_x)

    def test_known_distinct_same_spelled_symbols_remain_roundtrippable(self):
        bound = slice3_symbol_value('binder', 'binder:1')
        bound_sym = self.adapter.to_backend(bound)
        self.assertNotEqual(self.owned_x, bound_sym)
        result = self.adapter.from_backend(self.owned_x + bound_sym)
        nodes = result['data']['expr']['args']
        identities = [node['identity'] for node in nodes]
        self.assertCountEqual(identities, [self.public_x['data']['expr']['identity'], bound['data']['expr']['identity']])



"""P0011 Slice 4: SymPy rewriting and semantic identity pressure."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter


def slice4_value(node):
    return {"valueVersion": 1, "kind": "expression", "data": {"expr": node}}


def slice4_symbol(identity):
    return {"op": "symbolRef", "identity": identity}


def slice4_free(scope="task-A", name="x"):
    return {"identityVersion": 1, "kind": "free-symbol",
            "taskScopeId": scope, "name": name}


def slice4_bound(name="x"):
    return {"identityVersion": 1, "kind": "binder",
            "id": "binder:f:x", "displayName": name}


def slice4_integer(n):
    return {"op": "integer", "value": str(n)}


def slice4_rational(n, d):
    return {"op": "rational", "numerator": str(n), "denominator": str(d)}


class RewritePressure(unittest.TestCase):
    def test_cancellation_cannot_merge_two_different_x_identites(self):
        adapter = SympyValueAdapter()
        a, b = slice4_symbol(slice4_free()), slice4_symbol(slice4_bound())
        expression = slice4_value({"op": "add", "args": [
            a, {"op": "mul", "args": [slice4_integer(-1), b]},
        ]})
        result = adapter.to_backend(expression)
        self.assertEqual(len(result.free_symbols), 2)
        roundtrip = adapter.to_backend(adapter.from_backend(result))
        self.assertEqual(result, roundtrip)

    def test_same_semantic_identity_can_cancel(self):
        adapter = SympyValueAdapter()
        x = slice4_symbol(slice4_free())
        result = adapter.to_backend(slice4_value({"op": "add", "args": [
            x, {"op": "mul", "args": [slice4_integer(-1), x]},
        ]}))
        self.assertEqual(result, sp.Integer(0))
        self.assertEqual(adapter.from_backend(result), slice4_value(slice4_integer(0)))

    def test_nested_power_canonicalization_is_semantically_stable(self):
        adapter = SympyValueAdapter()
        expression = slice4_value({"op": "pow", "base": {"op": "pow",
            "base": slice4_symbol(slice4_free()), "exponent": slice4_integer(2)},
            "exponent": slice4_integer(3)})
        actual = adapter.to_backend(expression)
        self.assertEqual(actual, adapter.to_backend(adapter.from_backend(actual)))

    def test_very_large_integer_remains_exact_after_arithmetic(self):
        adapter = SympyValueAdapter()
        big = 10**90 + 17
        backend = adapter.to_backend(slice4_value({"op": "add", "args": [
            slice4_integer(big), slice4_integer(1),
        ]}))
        self.assertEqual(backend, sp.Integer(big + 1))
        self.assertEqual(adapter.from_backend(backend), slice4_value(slice4_integer(big+1)))

    def test_mixed_exact_and_approximate_remains_approximate(self):
        adapter = SympyValueAdapter()
        backend = adapter.to_backend(slice4_value({"op": "add", "args": [
            slice4_rational(1, 3), {"op": "approx", "value": "0.1"},
        ]}))
        self.assertTrue(backend.has(sp.Float))
        restored = adapter.from_backend(backend)
        self.assertEqual(adapter.to_backend(restored), backend)

    def test_unregistered_symbol_after_backend_rewrite_is_not_invented(self):
        adapter = SympyValueAdapter()
        owned = adapter.to_backend(slice4_value(slice4_symbol(slice4_free())))
        foreign = sp.Dummy("x")
        self.assertRaisesRegex(ValueError, "unregistered|identity",
                               adapter.from_backend, sp.expand((owned+foreign)**2))



"""P0011 Slice 4b: precision-preserving Value transport pressure.

These tests specify desired observable behavior, not a predetermined encoding.
They are expected to be RED against Slice 2's float serialization.
"""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter


class NumericalPrecisionTransportPressure(unittest.TestCase):
    def test_mixed_exact_and_approximate_result_survives_cache_roundtrip(self):
        adapter = SympyValueAdapter()
        result = sp.Rational(1, 3) + sp.Float("0.1")
        reconstructed = adapter.to_backend(adapter.from_backend(result))
        self.assertEqual(reconstructed, result)

    def test_high_precision_numeric_result_survives_roundtrip(self):
        adapter = SympyValueAdapter()
        result = sp.sqrt(2).evalf(80)
        reconstructed = adapter.to_backend(adapter.from_backend(result))
        self.assertEqual(reconstructed, result)

    def test_small_numeric_regression_like_coefficient_survives_roundtrip(self):
        adapter = SympyValueAdapter()
        result = sp.Float("0.000000012345678901234567890123456789", 80)
        reconstructed = adapter.to_backend(adapter.from_backend(result))
        self.assertEqual(reconstructed, result)

    def test_two_close_approximations_do_not_merge_after_transport(self):
        adapter = SympyValueAdapter()
        left = sp.Float("1.0000000000000001", 60)
        right = sp.Float("1.0000000000000002", 60)
        self.assertNotEqual(left, right)
        restored_left = adapter.to_backend(adapter.from_backend(left))
        restored_right = adapter.to_backend(adapter.from_backend(right))
        self.assertNotEqual(restored_left, restored_right)
        self.assertEqual(restored_left, left)
        self.assertEqual(restored_right, right)

