_REGISTRY = {}
_FORBIDDEN = set()

def register(name, forbidden=False, category=None):
    def decorator(func):
        _REGISTRY[name] = func
        if forbidden:
            _FORBIDDEN.add(name)
        return func
    return decorator

def build_context():
    return _REGISTRY.copy(), _FORBIDDEN.copy()

from . import calculus
from . import statistics

_REGISTRY['diff'] = calculus.diff
_FORBIDDEN.add('diff')
_REGISTRY['integrate'] = calculus.integrate_cas
_FORBIDDEN.add('integrate')
_REGISTRY['limit'] = calculus.limit
_FORBIDDEN.add('limit')
_REGISTRY['arclength'] = calculus.arclength
_FORBIDDEN.add('arclength')

_REGISTRY['mean'] = statistics.mean
_FORBIDDEN.add('mean')
_REGISTRY['median'] = statistics.median
_REGISTRY['Q1'] = statistics.Q1
_REGISTRY['Q3'] = statistics.Q3
_REGISTRY['min'] = statistics.min_func
_FORBIDDEN.add('min')
_REGISTRY['max'] = statistics.max_func
_FORBIDDEN.add('max')
_REGISTRY['linReg'] = statistics.linReg
_FORBIDDEN.add('linReg')
_REGISTRY['expReg'] = statistics.expReg
_FORBIDDEN.add('expReg')
_REGISTRY['powReg'] = statistics.powReg
_FORBIDDEN.add('powReg')
_REGISTRY['logReg'] = statistics.logReg
_FORBIDDEN.add('logReg')