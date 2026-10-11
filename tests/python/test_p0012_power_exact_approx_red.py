"""Power operands: exact rational and approximate inputs are distinct Values."""
import unittest
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator.scalar_power import evaluate_power_request
from test_p0012_power_red import integer, rational, expr, request, spec

class ExactApproxPowerPressure(unittest.TestCase):
    def test_approximate_half_exponent_is_approximate_result(self):
        approx_half = expr({'op': 'approx', 'value': '0.5'})
        result = evaluate_power_request(request([integer(2), approx_half]), spec())
        self.assertEqual(result['status'], 'success')
        node = result['value']['data']['expr']
        self.assertEqual(node['op'], 'approx')
        reconstructed = SympyValueAdapter().to_backend(result['value'])
        self.assertTrue(bool(reconstructed.atoms(sp.Float)))
        self.assertTrue(abs(float(reconstructed) - 2 ** 0.5) < 1e-14)

    def test_exact_half_exponent_stays_symbolic(self):
        result = evaluate_power_request(request([integer(2), rational(1, 2)]), spec())
        self.assertEqual(result['status'], 'success')
        node = result['value']['data']['expr']
        self.assertEqual(node['op'], 'pow')
        backend = SympyValueAdapter().to_backend(result['value'])
        self.assertEqual(backend, sp.sqrt(2))
        self.assertFalse(backend.has(sp.Float))

if __name__ == '__main__':
    unittest.main()
