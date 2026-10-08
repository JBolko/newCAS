"""P0011: disposable SymPy adapter for core ExpressionValue nodes.

No document/runtime lookup. The map preserves P0006 identities only within
this disposable adapter; SymPy Dummy indices are never public state.
"""
from __future__ import annotations

import sympy as sp


class SympyValueAdapter:
    def __init__(self):
        self._symbols = {}
        self._identities = {}

    @staticmethod
    def _identity_key(identity):
        if not isinstance(identity, dict) or identity.get('identityVersion') != 1:
            raise ValueError('invalid SemanticIdentity')
        kind = identity.get('kind')
        if kind == 'free-symbol':
            if set(identity) != {'identityVersion', 'kind', 'taskScopeId', 'name'}:
                raise ValueError('invalid free-symbol identity')
            scope, name = identity['taskScopeId'], identity['name']
            if not all(isinstance(x, str) and x for x in (scope, name)):
                raise ValueError('invalid free-symbol identity')
            return ('free-symbol', scope, name), name
        if kind in ('binder', 'operation-local'):
            if set(identity) != {'identityVersion', 'kind', 'id', 'displayName'}:
                raise ValueError('invalid bound identity')
            identifier, name = identity['id'], identity['displayName']
            if not all(isinstance(x, str) and x for x in (identifier, name)):
                raise ValueError('invalid bound identity')
            return (kind, identifier), name
        raise ValueError('unknown SemanticIdentity kind')

    def _symbol(self, identity):
        key, name = self._identity_key(identity)
        if key not in self._symbols:
            symbol = sp.Dummy(name)
            self._symbols[key] = symbol
            self._identities[symbol] = dict(identity)
        return self._symbols[key]

    def to_backend(self, value):
        if not isinstance(value, dict) or set(value) != {'valueVersion', 'kind', 'data'}:
            raise ValueError('expected P0005 Value envelope')
        if value['valueVersion'] != 1 or value['kind'] != 'expression':
            raise ValueError('unsupported Value kind in P0011 Slice 2')
        data = value['data']
        if not isinstance(data, dict) or set(data) != {'expr'}:
            raise ValueError('invalid ExpressionValue')
        return self._to_expr(data['expr'])

    def _to_expr(self, node):
        if not isinstance(node, dict):
            raise ValueError('invalid expression node')
        op = node.get('op')
        if op == 'symbolRef' and set(node) == {'op', 'identity'}:
            return self._symbol(node['identity'])
        if op == 'integer' and set(node) == {'op', 'value'}:
            return sp.Integer(node['value'])
        if op == 'rational' and set(node) == {'op', 'numerator', 'denominator'}:
            return sp.Rational(node['numerator'], node['denominator'])
        if op == 'approx' and set(node) in ({'op', 'value'}, {'op', 'value', 'precisionBits'}):
            # Legacy decimal input uses 53-bit working precision.
            # The new transport form carries the exact stored value and its
            # precision; decimal value is not a rendered/rounded number.
            bits = node.get('precisionBits', 53)
            if not isinstance(bits, int) or isinstance(bits, bool) or bits <= 0:
                raise ValueError('invalid precisionBits')
            return sp.Float(node['value'], precision=bits)
        if op in ('add', 'mul') and set(node) == {'op', 'args'}:
            args = node['args']
            if not isinstance(args, list) or len(args) < 2:
                raise ValueError('add/mul require at least two arguments')
            converted = [self._to_expr(arg) for arg in args]
            return sp.Add(*converted) if op == 'add' else sp.Mul(*converted)
        if op == 'pow' and set(node) == {'op', 'base', 'exponent'}:
            return sp.Pow(self._to_expr(node['base']), self._to_expr(node['exponent']))
        raise ValueError('unsupported ExpressionValue node in P0011 Slice 2')

    def from_backend(self, obj):
        node = self._from_expr(obj)
        return {'valueVersion': 1, 'kind': 'expression', 'data': {'expr': node}}

    def _from_expr(self, obj):
        if isinstance(obj, sp.Symbol):
            if obj not in self._identities:
                raise ValueError('unregistered backend symbol; no public identity available')
            return {'op': 'symbolRef', 'identity': dict(self._identities[obj])}
        if isinstance(obj, sp.Integer):
            return {'op': 'integer', 'value': str(obj)}
        if isinstance(obj, sp.Rational):
            return {'op': 'rational', 'numerator': str(obj.p), 'denominator': str(obj.q)}
        if isinstance(obj, sp.Float):
            if not obj.is_finite:
                raise ValueError('non-finite approximate value is unsupported')
            exact = sp.Rational(obj)
            denominator = int(exact.q)
            if denominator & (denominator - 1):
                raise AssertionError('finite binary Float is not dyadic')
            digits = denominator.bit_length() - 1
            coefficient = int(exact.p) * 5 ** digits
            return {'op': 'approx',
                    'value': f'{coefficient}e-{digits}' if digits else str(coefficient),
                    'precisionBits': int(obj._prec)}
        if isinstance(obj, sp.Add):
            return {'op': 'add', 'args': [self._from_expr(arg) for arg in obj.args]}
        if isinstance(obj, sp.Mul):
            return {'op': 'mul', 'args': [self._from_expr(arg) for arg in obj.args]}
        if isinstance(obj, sp.Pow):
            return {'op': 'pow', 'base': self._from_expr(obj.base),
                    'exponent': self._from_expr(obj.exp)}
        raise ValueError('unsupported SymPy result in P0011 Slice 2')
