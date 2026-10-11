"""P0012 exploratory arithmetic probe; no evaluator/dispatch implementation."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter


def val(expr):
    return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': expr}}


def i(n):
    return val({'op': 'integer', 'value': str(n)})


def r(n, d):
    return val({'op': 'rational', 'numerator': str(n), 'denominator': str(d)})


def a(text, bits=53):
    return val({'op': 'approx', 'value': text, 'precisionBits': bits})


def check(label, inputs, expected=None, predicate=None):
    bridge = SympyValueAdapter()   # disposable for each independent call
    result = sp.Add(*(bridge.to_backend(x) for x in inputs))
    restored = bridge.to_backend(bridge.from_backend(result))
    assert restored == result, (label, 'transport changed numeric meaning')
    if expected is not None:
        assert result == expected, (label, result, expected)
    if predicate is not None:
        assert predicate(result), (label, result)
    print(f'PASS: {label}')


def main():
    check('exact rational 1/2 + 1/3', [r(1, 2), r(1, 3)], sp.Rational(5, 6))
    check('large integer remains exact', [i(10**90 + 17), i(1)], sp.Integer(10**90 + 18))
    check('approximation remains approximate', [a('0.1'), r(1, 3)], predicate=lambda v: bool(v.atoms(sp.Float)))
    x = {'identityVersion': 1, 'kind': 'free-symbol', 'taskScopeId': 't', 'name': 'x'}
    y = {'identityVersion': 1, 'kind': 'binder', 'id': 'b:x', 'displayName': 'x'}
    check('same spelling, different semantic identities',
          [val({'op': 'symbolRef', 'identity': x}), val({'op': 'symbolRef', 'identity': y})],
          predicate=lambda v: len(v.free_symbols) == 2)
    print('ALL 4 SCALAR CORE PROBES PASS (not a P0012 evaluator)')


if __name__ == '__main__':
    main()
