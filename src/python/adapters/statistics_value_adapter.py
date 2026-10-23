"""Accepted P0005 v2 structural codec. No SymPy, evaluator or document state.

Returned records/arrays are immutable; encode_value is the JSON boundary.
The existing SympyValueAdapter and all existing v1 producers are untouched.
"""
from collections.abc import Mapping
import json
import math
import re
from types import MappingProxyType


VALUE_V2_LIMITS = MappingProxyType({'depth': 128, 'nodes': 100000, 'encoded-bytes': 8 * 1024 * 1024})
_ID = r'[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*'
_VERSIONED = r'[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*/v[1-9][0-9]*'
_INTEGER = r'-?(0|[1-9]\d*)'
_POSITIVE = r'[1-9]\d*'
_COUNT = r'0|[1-9]\d*'
_APPROX = r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?'
_KINDS = ('expression', 'function', 'relation', 'set', 'list', 'vector', 'matrix', 'quantity')


class _FrozenRecord(Mapping):
    __slots__ = ('__data',)

    def __init__(self, data):
        object.__setattr__(self, '_FrozenRecord__data', MappingProxyType(data))

    def __setattr__(self, key, value):
        raise TypeError('immutable Value record')

    def __getitem__(self, key):
        return self.__data[key]

    def __iter__(self):
        return iter(self.__data)

    def __len__(self):
        return len(self.__data)


class ValueCodecError(ValueError):
    def __init__(self, code, parameters):
        super().__init__(code)
        self.diagnostic = {'diagnosticVersion': 1, 'code': code, 'parameters': parameters}


def _path(path, key):
    return path + '/' + str(key).replace('~', '~0').replace('/', '~1')


def _invalid(path='', reason='leaf-shape'):
    raise ValueCodecError('invalid-value-encoding', {'path': path or '/', 'reason': reason})


def _unsupported(path, feature, actual, supported):
    raise ValueCodecError('unsupported-value-encoding', {'path': path or '/', 'feature': feature,
                                                      'actual': str(actual), 'supported': list(supported)})


def _resource(path, kind):
    raise ValueCodecError('value-codec-resource-limit', {'path': path or '/', 'resource': kind,
                                                       'limit': VALUE_V2_LIMITS[kind]})


def _quote(text):
    if re.search(r'[\ud800-\udfff]', text):
        text = text.encode('utf-16-le', 'surrogatepass').decode('utf-16-le', 'surrogatepass')
    encoded = json.dumps(text, ensure_ascii=False)
    return re.sub(r'[\ud800-\udfff]', lambda m: '\\u%04x' % ord(m[0]), encoded)


def _js_number(value):
    """JSON Number metadata only. Mathematical integers/counts remain strings."""
    n = float(value)
    if not math.isfinite(n):
        _invalid(reason='non-json-data')
    if n == 0:
        return '0'
    sign = '-' if n < 0 else ''
    text = repr(abs(n)).lower()
    mantissa, _, exponent = text.partition('e')
    exponent = int(exponent or '0')
    whole, _, fraction = mantissa.partition('.')
    digits = (whole + fraction).rstrip('0')
    point = len(whole) + exponent
    if 0 < point <= 21:
        body = digits[:point] + ('.' + digits[point:] if len(digits) > point else '0' * (point - len(digits)))
    elif -6 < point <= 0:
        body = '0.' + '0' * (-point) + digits
    else:
        body = digits[0] + ('.' + digits[1:] if len(digits) > 1 else '')
        power = point - 1
        body += 'e' + ('+' if power >= 0 else '-') + str(abs(power))
    return sign + body


def _quoted_bytes(text, available, path):
    if len(text) + 2 > available:
        _resource(path, 'encoded-bytes')
    if text.isascii() and not re.search(r'[\x00-\x1f"\\]', text):
        return len(text) + 2
    size, i = 2, 0
    while i < len(text):
        c = ord(text[i])
        if c in (34, 92):
            size += 2
        elif c < 32:
            size += 2 if c in (8, 9, 10, 12, 13) else 6
        elif c < 128:
            size += 1
        elif c < 2048:
            size += 2
        elif 0xd800 <= c <= 0xdbff:
            if i + 1 < len(text) and 0xdc00 <= ord(text[i + 1]) <= 0xdfff:
                size += 4
                i += 1
            else:
                size += 6
        elif 0xdc00 <= c <= 0xdfff:
            size += 6
        else:
            size += 4 if c > 0xffff else 3
        if size > available:
            _resource(path, 'encoded-bytes')
        i += 1
    return size


class _Budget:
    def __init__(self):
        self.nodes = self.bytes = 0

    def node(self, depth, path):
        if depth > VALUE_V2_LIMITS['depth']:
            _resource(path, 'depth')
        self.nodes += 1
        if self.nodes > VALUE_V2_LIMITS['nodes']:
            _resource(path, 'nodes')

    def width(self, length, path):
        if length > VALUE_V2_LIMITS['nodes'] - self.nodes:
            _resource(path, 'nodes')

    def add(self, size, path):
        self.bytes += size
        if self.bytes > VALUE_V2_LIMITS['encoded-bytes']:
            _resource(path, 'encoded-bytes')

    def string(self, text, path):
        self.bytes += _quoted_bytes(text, VALUE_V2_LIMITS['encoded-bytes'] - self.bytes, path)


def _snapshot(root, require_frozen=False, bounded=True):
    active, budget = set(), _Budget()

    def copy(value, depth, path):
        if bounded:
            budget.node(depth, path)
        t = type(value)
        if value is None or t is bool:
            if bounded:
                budget.add(4 if value is None or value else 5, path)
            return value
        if t is str:
            if bounded:
                budget.string(value, path)
            return value
        if t in (int, float):
            try:
                encoded = _js_number(value)
            except (OverflowError, ValueError):
                _invalid(path, 'non-json-data')
            if bounded:
                budget.add(len(encoded), path)
            return value
        if t not in (dict, _FrozenRecord, list, tuple):
            _invalid(path, 'record-shape')
        if id(value) in active:
            _invalid(path, 'non-json-data')
        array = t in (list, tuple)
        if require_frozen and t not in (_FrozenRecord, tuple):
            _invalid(path, 'mutable-value')
        if bounded:
            budget.width(len(value), path)
            budget.add(2 + max(0, len(value) - 1), path)
        active.add(id(value))
        if array:
            out = tuple(copy(child, depth + 1, _path(path, i)) for i, child in enumerate(value))
        else:
            data = {}
            for key, child in value.items():
                if type(key) is not str:
                    _invalid(path, 'field-set')
                at = _path(path, key)
                if bounded:
                    budget.string(key, at)
                    budget.add(1, at)
                data[key] = copy(child, depth + 1, at)
            out = _FrozenRecord(data)
        active.remove(id(value))
        return out
    return copy(root, 0, '')


def _record(value, fields, path, exact=True):
    if type(value) is not _FrozenRecord:
        _invalid(path, 'record-shape')
    if (exact and set(value) != set(fields)) or not set(value).issubset(fields):
        _invalid(path, 'field-set')


def _array(value, path, nonempty=False):
    if type(value) is not tuple or (nonempty and not value):
        _invalid(path)


def _integer(value):
    return type(value) in (int, float) and math.isfinite(value) and value == int(value)


def _string(value, path):
    if type(value) is not str or not value:
        _invalid(path)


def _identity(value, path):
    if type(value) is not _FrozenRecord or len(value) != 4 or type(value.get('identityVersion')) not in (int, float) or value.get('identityVersion') != 1:
        _invalid(path)
    kind = value.get('kind')
    fields = ('taskScopeId', 'name') if kind == 'free-symbol' else ('id', 'displayName')
    if kind not in ('free-symbol', 'binder', 'operation-local'):
        _invalid(path)
    for key in fields:
        _string(value.get(key), _path(path, key))


def _expr(node, path):
    if type(node) is not _FrozenRecord:
        _invalid(path)
    op = node.get('op')
    if op in ('integer', 'rational', 'approx'):
        fields = ('op', 'value') if op == 'integer' else ('op', 'numerator', 'denominator') if op == 'rational' else ('op', 'value', 'precisionBits')
        _record(node, fields, path, exact=False)
        checks = [('value', _INTEGER)] if op == 'integer' else [('numerator', _INTEGER), ('denominator', _POSITIVE)] if op == 'rational' else [('value', _APPROX)]
        for key, pattern in checks:
            if type(node.get(key)) is not str or not re.fullmatch(pattern, node[key], re.ASCII):
                _invalid(_path(path, key))
        if op == 'approx' and 'precisionBits' in node and (not _integer(node['precisionBits']) or not 1 <= node['precisionBits'] <= 9007199254740991):
            _invalid(path)
    elif op == 'symbolRef':
        _record(node, ('op', 'identity'), path)
        _identity(node['identity'], _path(path, 'identity'))
    elif op == 'constant':
        _record(node, ('op', 'name'), path)
        _string(node['name'], path)
    elif op == 'pow':
        _record(node, ('op', 'base', 'exponent'), path)
        _expr(node['base'], _path(path, 'base'))
        _expr(node['exponent'], _path(path, 'exponent'))
    elif op in ('add', 'mul', 'call'):
        _record(node, ('op', 'args', 'name') if op == 'call' else ('op', 'args'), path)
        _array(node['args'], path)
        if op == 'call':
            _string(node['name'], path)
        elif len(node['args']) < 2:
            _invalid(path)
        for i, child in enumerate(node['args']):
            _expr(child, _path(_path(path, 'args'), i))
    else:
        _invalid(path)


def _v1(value, path):
    _record(value, ('valueVersion', 'kind', 'data'), path)
    if type(value['valueVersion']) not in (int, float) or value['valueVersion'] != 1:
        _invalid(path, 'nesting-version')
    kind, data = value['kind'], value['data']
    if kind not in _KINDS:
        _invalid(path)
    at = _path(path, 'data')
    if kind == 'expression':
        _record(data, ('expr',), at)
        _expr(data['expr'], _path(at, 'expr'))
    elif kind in ('list', 'vector'):
        _record(data, ('items',), at)
        _array(data['items'], at)
        for i, child in enumerate(data['items']):
            _v1(child, _path(_path(at, 'items'), i))
    elif kind == 'quantity':
        _record(data, ('magnitude', 'unit'), at)
        _v1(data['magnitude'], _path(at, 'magnitude'))
        _string(data['unit'], _path(at, 'unit'))
    elif kind == 'relation':
        _record(data, ('operator', 'left', 'right'), at)
        if data['operator'] not in ('eq', 'ne', 'lt', 'le', 'gt', 'ge'):
            _invalid(at)
        _v1(data['left'], _path(at, 'left'))
        _v1(data['right'], _path(at, 'right'))
    elif kind == 'function':
        _record(data, ('parameters', 'body', 'capturedValues'), at)
        _array(data['parameters'], at)
        _array(data['capturedValues'], at)
        for i, parameter in enumerate(data['parameters']):
            p = _path(_path(at, 'parameters'), i)
            _record(parameter, ('identity',), p)
            _identity(parameter['identity'], _path(p, 'identity'))
        _v1(data['body'], _path(at, 'body'))
        for i, capture in enumerate(data['capturedValues']):
            p = _path(_path(at, 'capturedValues'), i)
            _record(capture, ('identity', 'value'), p)
            _identity(capture['identity'], _path(p, 'identity'))
            _v1(capture['value'], _path(p, 'value'))
    elif kind == 'matrix':
        _record(data, ('rows', 'cols', 'entries'), at)
        if any(not _integer(data[k]) or data[k] < 0 for k in ('rows', 'cols')):
            _invalid(at)
        _array(data['entries'], at)
        if len(data['entries']) != data['rows']:
            _invalid(at)
        for i, row in enumerate(data['entries']):
            _array(row, at)
            if len(row) != data['cols']:
                _invalid(at)
            for j, child in enumerate(row):
                _v1(child, _path(_path(_path(at, 'entries'), i), j))
    else:
        _set(data, at)
    return value


def _set(data, path):
    if type(data) is not _FrozenRecord:
        _invalid(path)
    kind = data.get('setKind')
    if kind == 'empty':
        _record(data, ('setKind',), path)
    elif kind in ('finite', 'union'):
        key = 'items' if kind == 'finite' else 'sets'
        _record(data, ('setKind', key), path)
        _array(data[key], path)
        if kind == 'union' and len(data[key]) < 2:
            _invalid(path)
        for i, child in enumerate(data[key]):
            _v1(child, _path(_path(path, key), i))
            if kind == 'union' and child['kind'] != 'set':
                _invalid(path)
    elif kind == 'interval':
        _record(data, ('setKind', 'lower', 'upper', 'lowerClosed', 'upperClosed'), path)
        for side in ('lower', 'upper'):
            if type(data[side + 'Closed']) is not bool:
                _invalid(path)
            bound = data[side]
            if type(bound) is _FrozenRecord and set(bound) == {'bound'}:
                if bound['bound'] != ('negative-infinity' if side == 'lower' else 'positive-infinity') or data[side + 'Closed']:
                    _invalid(path)
            else:
                _v1(bound, _path(path, side))
                if bound['kind'] != 'expression':
                    _invalid(path)
    else:
        _invalid(path)


def _id(value, path, versioned=False):
    if type(value) is not str or not re.fullmatch(_VERSIONED if versioned else _ID, value, re.ASCII):
        _invalid(path)


def _scalar(value, path, count=False):
    _v1(value, path)
    expr = value['data'].get('expr')
    if value['kind'] != 'expression' or type(expr) is not _FrozenRecord or expr.get('op') not in ('integer', 'rational'):
        _invalid(path)
    if count and (expr['op'] != 'integer' or not re.fullmatch(_COUNT, expr['value'], re.ASCII)):
        _invalid(path)
    return value


def _visit(value, path=''):
    _record(value, ('valueVersion', 'kind', 'data'), path)
    version = value['valueVersion']
    if not _integer(version):
        _invalid(_path(path, 'valueVersion'), 'version-shape')
    if version == 1:
        return _v1(value, path)
    if version != 2:
        _unsupported(_path(path, 'valueVersion'), 'value-version', _js_number(version), ('1', '2'))
    kind, data = value['kind'], value['data']
    _string(kind, _path(path, 'kind'))
    at = _path(path, 'data')
    if kind == 'list':
        _record(data, ('items',), at)
        _array(data['items'], _path(at, 'items'))
        out = {'items': tuple(_visit(child, _path(_path(at, 'items'), i)) for i, child in enumerate(data['items']))}
    elif kind == 'statistics':
        if type(data) is not _FrozenRecord:
            _invalid(at, 'record-shape')
        variant = data.get('variant')
        if variant == 'grouped-data':
            _record(data, ('variant', 'basisKind', 'classes'), at)
            if data['basisKind'] != 'interval-grouped':
                _invalid(_path(at, 'basisKind'), 'variant-shape')
            _array(data['classes'], _path(at, 'classes'), True)
            classes = []
            for i, c in enumerate(data['classes']):
                p = _path(_path(at, 'classes'), i)
                _record(c, ('lower', 'upper', 'lowerClosed', 'upperClosed', 'count'), p)
                if type(c['lowerClosed']) is not bool or type(c['upperClosed']) is not bool:
                    _invalid(p)
                classes.append(_FrozenRecord({'lower': _scalar(c['lower'], _path(p, 'lower')),
                                              'upper': _scalar(c['upper'], _path(p, 'upper')),
                                              'lowerClosed': c['lowerClosed'], 'upperClosed': c['upperClosed'],
                                              'count': _scalar(c['count'], _path(p, 'count'), True)}))
            out = {'variant': variant, 'basisKind': data['basisKind'], 'classes': tuple(classes)}
        elif variant == 'statistical-result':
            fields = ('variant', 'statisticId', 'methodId', 'estimand', 'arithmetic', 'estimateStatus', 'assumptions', 'provenance', 'value')
            _record(data, fields, at)
            for key in ('statisticId', 'methodId', 'estimand'):
                _id(data[key], _path(at, key), key != 'statisticId')
            if data['arithmetic'] not in ('exact', 'approximate') or data['estimateStatus'] not in ('known', 'estimated'):
                _invalid(at)
            _array(data['assumptions'], _path(at, 'assumptions'))
            for i, a in enumerate(data['assumptions']):
                _id(a, _path(_path(at, 'assumptions'), i), True)
            if len(set(data['assumptions'])) != len(data['assumptions']):
                _invalid(_path(at, 'assumptions'))
            p = _path(at, 'provenance')
            _record(data['provenance'], ('inputs',), p)
            _array(data['provenance']['inputs'], _path(p, 'inputs'), True)
            inputs, roles = [], set()
            for i, item in enumerate(data['provenance']['inputs']):
                pos = _path(_path(p, 'inputs'), i)
                _record(item, ('role', 'value'), pos)
                _id(item['role'], _path(pos, 'role'))
                if item['role'] in roles:
                    _invalid(_path(pos, 'role'))
                roles.add(item['role'])
                inputs.append(_FrozenRecord({'role': item['role'], 'value': _visit(item['value'], _path(pos, 'value'))}))
            out = {key: data[key] for key in fields[:6]}
            out.update(assumptions=tuple(sorted(data['assumptions'])), provenance=_FrozenRecord({'inputs': tuple(inputs)}), value=_v1(data['value'], _path(at, 'value')))
        else:
            if type(variant) is not str or not variant:
                _invalid(_path(at, 'variant'), 'variant-shape')
            _unsupported(_path(at, 'variant'), 'statistics-variant', variant, ('grouped-data', 'statistical-result'))
    else:
        _unsupported(_path(path, 'kind'), 'value-kind', kind, ('statistics', 'list'))
    return _FrozenRecord({'valueVersion': 2, 'kind': kind, 'data': _FrozenRecord(out)})


def _string_end(text, start):
    i = start + 1
    while i < len(text):
        if text[i] == '\\':
            i += 1
        elif text[i] == '"':
            return i + 1
        i += 1
    raise ValueError('unterminated JSON string')


def _skip_space(text, start):
    while start < len(text) and text[start] in ' \t\r\n':
        start += 1
    return start


def _encoded_version(text):
    depth, version, i = 0, None, 0
    while i < len(text):
        c = text[i]
        if c == '"':
            end = _string_end(text, i)
            colon = _skip_space(text, end)
            if depth == 1 and colon < len(text) and text[colon] == ':' and end - i <= 74 and json.loads(text[i:end]) == 'valueVersion':
                start = _skip_space(text, colon + 1)
                end = start
                while end < len(text) and text[end] in '-+.eE0123456789':
                    end += 1
                try:
                    version = float(text[start:end])
                except ValueError:
                    version = None
            i = end
            continue
        if c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
        i += 1
    return version


def _strict_json(text):
    def reject_constant(_):
        raise ValueError('non-JSON constant')
    return json.loads(text, parse_constant=reject_constant)


def _preflight_json(text):
    b, depth, i = _Budget(), 0, 0
    while i < len(text):
        c = text[i]
        if c in ' \t\r\n':
            i += 1
            continue
        if c in '{[':
            b.node(depth, '')
            depth += 1
            b.add(1, '')
            i += 1
            continue
        if c in '}]':
            depth -= 1
            b.add(1, '')
            i += 1
            continue
        if c in ',:':
            b.add(1, '')
            i += 1
            continue
        if c == '"':
            end = _string_end(text, i)
            if end - i > 6 * VALUE_V2_LIMITS['encoded-bytes'] + 2:
                _resource('', 'encoded-bytes')
            after = _skip_space(text, end)
            if after >= len(text) or text[after] != ':':
                b.node(depth, '')
            b.string(_strict_json(text[i:end]), '')
            i = end
            continue
        end = i
        while end < len(text) and text[end] not in ' \t\r\n,]}:':
            end += 1
        if end == i:
            raise ValueError('invalid JSON token')
        b.node(depth, '')
        token = text[i:end]
        b.add(len(token) if token in ('null', 'true', 'false') else len(_js_number(_strict_json(token))), '')
        i = end


def _tokens(value):
    if type(value) is _FrozenRecord:
        yield '{'
        for i, (key, child) in enumerate(value.items()):
            if i:
                yield ','
            yield _quote(key)
            yield ':'
            yield from _tokens(child)
        yield '}'
    elif type(value) is tuple:
        yield '['
        for i, child in enumerate(value):
            if i:
                yield ','
            yield from _tokens(child)
        yield ']'
    elif type(value) is str:
        yield _quote(value)
    elif value is None:
        yield 'null'
    elif type(value) is bool:
        yield 'true' if value else 'false'
    else:
        yield _js_number(value)


def statistics_value(data):
    return _visit(_snapshot({'valueVersion': 2, 'kind': 'statistics', 'data': data}))


def list_v2(items):
    return _visit(_snapshot({'valueVersion': 2, 'kind': 'list', 'data': {'items': items}}))


def materialize_value(value):
    """Typed object ingress, before JSON/clone; shared with transport, not a codec fork."""
    version = value.get('valueVersion') if type(value) in (dict, _FrozenRecord) else None
    bounded = not (type(version) in (int, float) and version == 1)
    return _visit(_snapshot(value, bounded=bounded))


def decode_value(serialized):
    if type(serialized) is not str:
        _invalid(reason='json-syntax')
    try:
        bounded = _encoded_version(serialized) != 1
        if bounded:
            _preflight_json(serialized)
        parsed = _strict_json(serialized)
    except ValueCodecError:
        raise
    except (ValueError, OverflowError, RecursionError):
        _invalid(reason='json-syntax')
    return _visit(_snapshot(parsed, bounded=bounded))


def encode_value(value):
    bounded = not (type(value) is _FrozenRecord and value.get('valueVersion') == 1)
    return ''.join(_tokens(_visit(_snapshot(value, require_frozen=True, bounded=bounded))))


def is_value(value):
    try:
        encode_value(value)
        return True
    except (ValueError, TypeError, RecursionError):
        return False


def same_value(left, right):
    return encode_value(left) == encode_value(right)
