"""Additional differentiation regression: chain rule and elementary calls."""
import unittest
from src.python.evaluator.scalar_differentiation import evaluate_diff_request
from test_p0012_differentiation_red import sym, val, power, mul, num, spec, req


def call(name, arg):
    return val({'op':'call','name':name,'args':[arg['data']['expr']]})


def derivative(expr, var):
    result = evaluate_diff_request(req([expr, var]), spec())
    assert result['status'] == 'success', result
    return result['value']


class DifferentiationFunctionPressure(unittest.TestCase):
    def test_sine_derivative(self):
        x = sym('x')
        self.assertEqual(derivative(call('sin', x), x), call('cos', x))

    def test_cosine_derivative(self):
        x = sym('x')
        result = derivative(call('cos', x), x)
        self.assertEqual(result['data']['expr']['op'], 'mul')
        self.assertIn("'sin'", str(result))

    def test_exp_derivative(self):
        x = sym('x')
        self.assertEqual(derivative(call('exp', x), x), call('exp', x))

    def test_log_derivative(self):
        x = sym('x')
        result = derivative(call('log', x), x)
        self.assertEqual(result['data']['expr']['op'], 'pow')
        self.assertEqual(result['data']['expr']['base'], x['data']['expr'])

    def test_sine_chain_rule(self):
        x = sym('x')
        result = derivative(call('sin', power(x, 2)), x)
        self.assertIn("'cos'", str(result))
        self.assertIn("'integer', 'value': '2'", str(result))

    def test_mixed_partial_by_nesting(self):
        x, y = sym('x'), sym('y')
        self.assertEqual(derivative(derivative(mul(x, y), x), y), num(1))
