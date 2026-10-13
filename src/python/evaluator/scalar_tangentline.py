"""Selected tangentline operation: return an ExpressionValue, not y=... ."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure

_CAPABILITY = 'probe.symbolic.tangentline'


def evaluate_tangentline_request(request, operation_spec):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('expected request and selected spec')
    if request.get('evaluationRequestVersion') != 1 or operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('unsupported version')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('invalid operationId')
    evaluator_id = request.get('evaluatorId')
    if not isinstance(evaluator_id, str) or not evaluator_id:
        raise ValueError('invalid evaluatorId')
    if evaluator_id != operation_spec.get('evaluatorId') or evaluator_id != _CAPABILITY:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError('tangentline expects empty instruction/options')
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError('tangentline expects one signature')
    args = signatures[0].get('arguments') if isinstance(signatures[0],dict) else None
    if (not isinstance(args,list) or len(args)!=3 or
        any(not isinstance(a,dict) or not isinstance(a.get('name'),str) or not a['name'] for a in args) or
        [a.get('role') for a in args] != ['value','symbolic','value']):
        raise ValueError('invalid tangentline signature')
    inputs = request.get('inputs')
    if not isinstance(inputs,list):
        raise ValueError('inputs must be a list')
    if len(inputs) != 3:
        return _failure('wrong-arity', {'operationId': operation_id, 'expected':[3], 'actual': len(inputs)})
    for arg,v in zip(args,inputs):
        if not isinstance(v,dict):
            raise ValueError('inputs must contain Values')
        if v.get('kind')!='expression':
            return _failure('type-mismatch', {'operationId':operation_id, 'argument':arg['name'],
                                              'expectedKinds':['expression'],'actualKind':str(v.get('kind','unknown'))})
    target=inputs[1].get('data',{}).get('expr')
    if not isinstance(target,dict) or target.get('op')!='symbolRef':
        return _failure('type-mismatch', {'operationId':operation_id,'argument':args[1]['name'],
                                          'expectedKinds':['symbol-reference'], 'actualKind':'non-symbol-reference'})
    adapter=SympyValueAdapter()
    expression,variable,at=(adapter.to_backend(v) for v in inputs)
    if not isinstance(variable,sp.Symbol):
        raise ValueError('symbolic target did not resolve to a SymPy symbol')
    if at.free_symbols:
        # Symbolic evaluation points may be meaningful later but aren't part of this slice.
        return _failure('unsupported-operation', {'operationId':operation_id})
    slope=sp.diff(expression,variable).subs(variable,at)
    intercept=expression.subs(variable,at)
    result=sp.expand(slope*(variable-at)+intercept)
    if result.has(sp.nan,sp.zoo,sp.oo,-sp.oo,sp.Derivative,sp.Subs):
        return _failure('unsupported-operation', {'operationId':operation_id})
    try:
        output=adapter.from_backend(result)
    except (ValueError,TypeError,NotImplementedError):
        return _failure('unsupported-operation', {'operationId':operation_id})
    return {'evaluationOutcomeVersion':1,'status':'success','value':output}
