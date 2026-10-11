import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter

class ComplexExpressionTransport(unittest.TestCase):
    def roundtrip(self, obj):
        adapter = SympyValueAdapter()
        public = adapter.from_backend(obj)
        self.assertEqual(public['valueVersion'], 1)
        self.assertEqual(public['kind'], 'expression')
        self.assertEqual(adapter.to_backend(public), obj)
        return public

    def test_i_exact(self):
        self.assertEqual(self.roundtrip(sp.I)['data']['expr'], {'op':'constant','name':'I'})

    def test_sqrt_minus_one(self):
        self.assertEqual(self.roundtrip(sp.sqrt(-1))['data']['expr'], {'op':'constant','name':'I'})

    def test_exact_complex_addition(self):
        self.roundtrip(2+3*sp.I)

    def test_exact_complex_subtraction(self):
        self.roundtrip(sp.Rational(1,2)-sp.I)

    def test_approximate_components_stay_approximate(self):
        public = self.roundtrip(sp.Float('0.5')+sp.Float('1.25')*sp.I)
        self.assertIn('approx', str(public))
        self.assertIn('precisionBits', str(public))

    def test_unregistered_symbol_with_complex_value_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unregistered backend symbol'):
            SympyValueAdapter().from_backend(sp.Symbol('x')+sp.I)

    def test_same_named_symbols_keep_identity_with_complex_value(self):
        a = {'identityVersion':1,'kind':'free-symbol','taskScopeId':'a','name':'x'}
        b = {'identityVersion':1,'kind':'free-symbol','taskScopeId':'b','name':'x'}
        def value(identity):
            return {'valueVersion':1,'kind':'expression','data':{'expr': {'op':'add','args':[{'op':'symbolRef','identity':identity},{'op':'constant','name':'I'}]}}}
        adapter = SympyValueAdapter()
        aa, bb = adapter.to_backend(value(a)), adapter.to_backend(value(b))
        self.assertNotEqual(aa,bb)
        self.assertIn({'op':'constant','name':'I'}, adapter.from_backend(aa)['data']['expr']['args'])
