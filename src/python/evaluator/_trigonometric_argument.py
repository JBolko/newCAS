"""Shared angle preparation for selected trigonometric operations.

No operation dispatch, no implicit document defaults, no SymPy state.
"""

import sympy as sp

from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._unary_value_contract import validate_unary_value_request


def prepare_trigonometric_argument(request, operation_spec, capability, label):
    """Return (failure, adapter, radians) with the selected angle policy applied."""
    failure = validate_unary_value_request(request, operation_spec, capability, label)
    if failure is not None:
        return failure, None, None

    options = request.get('options')
    if not isinstance(options, dict) or set(options) != {'angleUnit'}:
        raise ValueError(f'{label} requires an explicit angleUnit option')
    angle_unit = options['angleUnit']
    if angle_unit not in ('deg', 'rad'):
        raise ValueError('angleUnit must be deg or rad')

    adapter = SympyValueAdapter()
    angle = adapter.to_backend(request['inputs'][0])
    radians = angle * sp.pi / 180 if angle_unit == 'deg' else angle
    return None, adapter, radians
