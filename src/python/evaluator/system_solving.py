"""Finite isolated real solutions to systems; coordinate order is explicit."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure

_CAPABILITY = 'probe.symbolic.solve-system'


def _value(kind, data):
    return {'valueVersion': 1, 'kind': kind, 'data': data}


def evaluate_system_request(request, selected_spec):
    """Inputs: ListValue of RelationValues, ListValue of symbol references.

    Returns finite SetValue of VectorValues, each in target-list order.
    """
    if not isinstance(request, dict) or not isinstance(selected_spec, dict):
        raise ValueError('request and spec required')
    if request.get('evaluationRequestVersion') != 1 or selected_spec.get('operationSpecVersion') != 1:
        raise ValueError('invalid contract version')
    operation_id = selected_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('operationId required')
    if request.get('evaluatorId') != selected_spec.get('evaluatorId') or request.get('evaluatorId') != _CAPABILITY:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('options') != {} or request.get('instruction') != {}:
        raise ValueError('system solve options/instruction not supported')
    signatures = selected_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1 or not isinstance(signatures[0], dict):
        raise ValueError('one selected signature required')
    args = signatures[0].get('arguments')
    if not isinstance(args, list) or len(args) != 2 or any(not isinstance(a, dict) or not isinstance(a.get('name'),str) or not a['name'] for a in args):
        raise ValueError('system solve requires two named argument specifications')
    if [a.get('role') for a in args] != ['value', 'symbolic']:
        raise ValueError('system solve expects value and symbolic roles')
    inputs = request.get('inputs')
    if not isinstance(inputs, list):
        raise ValueError('inputs must be a list')
    if len(inputs) != 2:
        return _failure('wrong-arity', {'operationId': operation_id, 'expected': [2], 'actual': len(inputs)})
    equations, targets = inputs
    def mismatch(index, expectation):
        return _failure('type-mismatch', {'operationId':operation_id,'argument':args[index]['name'],
                          'expectedKinds':[expectation], 'actualKind':'invalid-system-input'})
    if not isinstance(equations,dict) or equations.get('kind') != 'list' or not isinstance(equations.get('data'),dict) or not isinstance(equations['data'].get('items'),list) or not equations['data']['items']:
        return mismatch(0,'nonempty-list-of-equalities')
    if not isinstance(targets,dict) or targets.get('kind') != 'list' or not isinstance(targets.get('data'),dict) or not isinstance(targets['data'].get('items'),list) or not targets['data']['items']:
        return mismatch(1,'nonempty-list-of-symbol-references')
    rels, syms = equations['data']['items'], targets['data']['items']
    for rel in rels:
        if not isinstance(rel,dict) or rel.get('kind')!='relation' or not isinstance(rel.get('data'),dict) or rel['data'].get('operator')!='eq' or any(not isinstance(rel['data'].get(side),dict) or rel['data'][side].get('kind')!='expression' for side in ('left','right')):
            return mismatch(0,'list-of-equalities')
    for sym in syms:
        if not isinstance(sym,dict) or sym.get('kind')!='expression' or not isinstance(sym.get('data'),dict) or not isinstance(sym['data'].get('expr'),dict) or sym['data']['expr'].get('op')!='symbolRef':
            return mismatch(1,'list-of-symbol-references')
    adapter=SympyValueAdapter()
    variables=[adapter.to_backend(v) for v in syms]
    if len(set(variables)) != len(variables):
        return mismatch(1,'distinct-symbol-references')
    expressions=[adapter.to_backend(r['data']['left'])-adapter.to_backend(r['data']['right']) for r in rels]
    try:
        solutions=sp.solve(expressions, variables, dict=True)
    except (NotImplementedError, ValueError, TypeError):
        return _failure('unsupported-operation', {'operationId':operation_id})
    rows=[]
    for solution in solutions:
        if any(v not in solution for v in variables):
            return _failure('unsupported-operation', {'operationId':operation_id})
        coords=[solution[v] for v in variables]
        # This slice requires finite, isolated real coordinates; no hidden parameters.
        if any(c.is_finite is not True or c.is_real is not True or (c.free_symbols & set(variables)) for c in coords):
            return _failure('unsupported-operation', {'operationId':operation_id})
        try:
            rows.append(_value('vector',{'items':[adapter.from_backend(c) for c in coords]}))
        except (ValueError,TypeError,NotImplementedError):
            return _failure('unsupported-operation', {'operationId':operation_id})
    # Stable encoding order. Set contents are unordered mathematically.
    import json
    rows.sort(key=lambda r: json.dumps(r, sort_keys=True,ensure_ascii=False))
    result = {'setKind':'finite','items':rows} if rows else {'setKind':'empty'}
    return {'evaluationOutcomeVersion':1,'status':'success','value':_value('set',result)}
