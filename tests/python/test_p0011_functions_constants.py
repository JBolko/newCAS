import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter

def v(node): return {"valueVersion":1,"kind":"expression","data":{"expr":node}}
def i(x):return {"op":"integer","value":str(x)}
def sym(name, scope):return {"op":"symbolRef","identity":{"identityVersion":1,"kind":"free-symbol","taskScopeId":scope,"name":name}}
class P0011FunctionAndConstantPressure(unittest.TestCase):
    def test_pi_roundtrip(self):
        a=SympyValueAdapter(); self.assertEqual(a.from_backend(a.to_backend(v({"op":"constant","name":"pi"}))),v({"op":"constant","name":"pi"}))
    def test_E_roundtrip(self):
        a=SympyValueAdapter();self.assertEqual(a.from_backend(a.to_backend(v({"op":"constant","name":"E"}))),v({"op":"constant","name":"E"}))
    def test_functions_roundtrip_without_evaluation(self):
        for name in ('sin','cos','exp','log'):
            with self.subTest(name=name):
                a=SympyValueAdapter();value=v({"op":"call","name":name,"args":[i(0)]})
                self.assertEqual(a.from_backend(a.to_backend(value)),value)
    def test_symbol_identity_preserved_through_calls(self):
        x=sym('x','scope-a');y=sym('x','scope-b')
        a=SympyValueAdapter();f=a.to_backend(v({'op':'call','name':'sin','args':[x]}));g=a.to_backend(v({'op':'call','name':'sin','args':[y]}))
        self.assertNotEqual(f,g)
        self.assertEqual(a.from_backend(f),v({'op':'call','name':'sin','args':[x]}))
        self.assertEqual(a.from_backend(g),v({'op':'call','name':'sin','args':[y]}))
    def test_backend_composition(self):
        a=SympyValueAdapter();x=sym('x','task-1');sym_x=a.to_backend(v(x))
        self.assertEqual(a.from_backend(sp.sin(sym_x)),v({'op':'call','name':'sin','args':[x]}))
        self.assertEqual(a.from_backend(sp.pi),v({'op':'constant','name':'pi'}))
    def test_unrecognized_function_and_constant_rejected(self):
        a=SympyValueAdapter()
        with self.assertRaises(ValueError):a.to_backend(v({'op':'call','name':'sinh','args':[i(3)]}))
        with self.assertRaises(ValueError):a.to_backend(v({'op':'constant','name':'tau'}))
        with self.assertRaises(ValueError):a.from_backend(sp.tan(sp.Symbol('x')))
    def test_arbitrary_backend_functions_not_exposed(self):
        a=SympyValueAdapter()
        with self.assertRaises(ValueError):a.from_backend(sp.Function('mystery')(sp.Integer(1)))
    def test_symbolic_identity_not_auto_inferred(self):
        a=SympyValueAdapter()
        with self.assertRaises(ValueError):a.from_backend(sp.sin(sp.Symbol('x')))
    def test_no_angle_mode_in_adapter(self):
        a=SympyValueAdapter();node={'op':'call','name':'sin','args':[i(30)]}
        self.assertEqual(a.from_backend(a.to_backend(v(node))),v(node))
