import unittest
import sympy as sp
from src.python.evaluator.scalar_integration import evaluate_integral_request
from src.python.adapters.sympy_value_adapter import SympyValueAdapter

def v(n): return {"valueVersion":1,"kind":"expression","data":{"expr":n}}
def integer(n):return v({"op":"integer","value":str(n)})
def sym(name="x",scope="s"):return v({"op":"symbolRef","identity":{"identityVersion":1,"kind":"free-symbol","taskScopeId":scope,"name":name}})
def power(x,n):return v({"op":"pow","base":x["data"]["expr"],"exponent":integer(n)["data"]["expr"]})
def spec(definite=False,role="symbolic",eid="probe.symbolic.integrate"):
    args=[{"name":"integrand","role":"value"},{"name":"variable","role":role}]
    if definite:args.extend([{"name":"lower","role":"value"},{"name":"upper","role":"value"}])
    return {"operationSpecVersion":1,"operationId":"integral","evaluatorId":eid,"signatures":[{"arguments":args}]}
def req(args,eid="probe.symbolic.integrate"):
    return {"evaluationRequestVersion":1,"evaluatorId":eid,"instruction":{},"inputs":args,"options":{}}
def as_sp(out):
    assert out["status"]=="success",out
    return SympyValueAdapter().to_backend(out["value"])

class IntegrationPressure(unittest.TestCase):
    def test_polynomial_primitive(self):
        x=sym()
        primitive=as_sp(evaluate_integral_request(req([power(x,2),x]),spec()))
        symbolic_variable=next(iter(primitive.free_symbols))
        self.assertEqual(sp.simplify(primitive-symbolic_variable**3/3),0)
    def test_derivative_of_primitive_is_integrand(self):
        x=sym();out=evaluate_integral_request(req([power(x,2),x]),spec())
        a=SympyValueAdapter();primitive=a.to_backend(out["value"]);self.assertEqual(sp.simplify(sp.diff(primitive, list(primitive.free_symbols)[0])-list(primitive.free_symbols)[0]**2),0)
    def test_definite_zero_to_one(self):
        x=sym();self.assertEqual(as_sp(evaluate_integral_request(req([power(x,2),x,integer(0),integer(1)]),spec(True))),sp.Rational(1,3))
    def test_reverse_limits(self):
        x=sym();self.assertEqual(as_sp(evaluate_integral_request(req([power(x,2),x,integer(1),integer(0)]),spec(True))),-sp.Rational(1,3))
    def test_partial_integral_other_symbol_stays_symbolic(self):
        x=sym("x"); y=sym("y")
        result=evaluate_integral_request(req([y,x]),spec())
        self.assertEqual(result["status"],"success")
        self.assertIn("y",str(result["value"]))
    def test_same_named_distinct_symbols(self):
        xa=sym("x","a");xb=sym("x","b")
        self.assertEqual(evaluate_integral_request(req([xa,xb]),spec())["status"],"success")
    def test_non_symbol_target(self):
        x=sym();o=evaluate_integral_request(req([x,integer(2)]),spec())
        self.assertEqual(o["diagnostic"]["code"],"type-mismatch")
    def test_arity(self):
        self.assertEqual(evaluate_integral_request(req([integer(3)]),spec())["diagnostic"]["code"],"wrong-arity")
    def test_wrong_handler(self):
        x=sym();self.assertEqual(evaluate_integral_request(req([x,x]),spec(eid="probe.symbolic.diff"))["diagnostic"]["code"],"unsupported-operation")
    def test_wrong_role(self):
        x=sym()
        with self.assertRaises(ValueError):evaluate_integral_request(req([x,x]),spec(role="value"))
    def test_unsupported_unevaluated_integral_does_not_leak(self):
        x=sym();ex=v({"op":"call","name":"exp","args":[{"op":"pow","base":x["data"]["expr"],"exponent":{"op":"integer","value":"3"}}]})
        self.assertEqual(evaluate_integral_request(req([ex,x]),spec())["diagnostic"]["code"],"unsupported-operation")
