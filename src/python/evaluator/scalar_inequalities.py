"""Bounded real univariate inequalities, with honest SetValue transport limits."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure

_CAPABILITY = 'probe.symbolic.solve-inequality'
_OPS = {'lt':sp.Lt,'le':sp.Le,'gt':sp.Gt,'ge':sp.Ge}


def evaluate_inequality_request(request, selected_spec):
    if not isinstance(request,dict) or not isinstance(selected_spec,dict):
        raise ValueError('request and selected specification required')
    if request.get('evaluationRequestVersion') != 1 or selected_spec.get('operationSpecVersion') != 1:
        raise ValueError('invalid contract version')
    operation_id=selected_spec.get('operationId')
    if not isinstance(operation_id,str) or not operation_id:
        raise ValueError('operationId required')
    if request.get('evaluatorId') != selected_spec.get('evaluatorId') or request.get('evaluatorId') != _CAPABILITY:
        return _failure('unsupported-operation', {'operationId':operation_id})
    if request.get('instruction') != {} or request.get('options') != {}:
        raise ValueError('unsupported options/instruction')
    signatures=selected_spec.get('signatures')
    if not isinstance(signatures,list) or len(signatures)!=1 or not isinstance(signatures[0],dict):
        raise ValueError('one selected signature required')
    args=signatures[0].get('arguments')
    if not isinstance(args,list) or len(args)!=2 or any(not isinstance(a,dict) or not isinstance(a.get('name'),str) or not a['name'] for a in args):
        raise ValueError('two named argument specifications required')
    if [a.get('role') for a in args] != ['value','symbolic']:
        raise ValueError('inequality roles must be value and symbolic')
    inputs=request.get('inputs')
    if not isinstance(inputs,list):
        raise ValueError('inputs must be list')
    if len(inputs)!=2:
        return _failure('wrong-arity', {'operationId':operation_id,'expected':[2],'actual':len(inputs)})
    rel,target=inputs
    def mismatch(idx,expect):
        return _failure('type-mismatch',{'operationId':operation_id,'argument':args[idx]['name'],'expectedKinds':[expect],'actualKind':'invalid-input'})
    if not isinstance(rel,dict) or rel.get('kind')!='relation' or not isinstance(rel.get('data'),dict) or rel['data'].get('operator') not in _OPS:
        return mismatch(0,'inequality-relation')
    if any(not isinstance(rel['data'].get(k),dict) or rel['data'][k].get('kind')!='expression' for k in ('left','right')):
        return mismatch(0,'inequality-of-expressions')
    if not isinstance(target,dict) or target.get('kind')!='expression' or not isinstance(target.get('data'),dict) or not isinstance(target['data'].get('expr'),dict) or target['data']['expr'].get('op')!='symbolRef':
        return mismatch(1,'symbol-reference')
    adapter=SympyValueAdapter()
    lhs=adapter.to_backend(rel['data']['left']); rhs=adapter.to_backend(rel['data']['right'])
    x=adapter.to_backend(target)
    if not isinstance(x,sp.Symbol):
        return mismatch(1,'symbol-reference')
    try:
        inequality=_OPS[rel['data']['operator']](lhs,rhs,evaluate=False)
        solution=sp.solve_univariate_inequality(inequality,x,relational=False)
    except (ValueError,TypeError,NotImplementedError):
        return _failure('unsupported-operation',{'operationId':operation_id})
    def encode_set(item):
        if item == sp.S.EmptySet:
            return {'setKind':'empty'}
        if item == sp.S.Reals:
            item = sp.Interval(-sp.oo, sp.oo)
        if isinstance(item, sp.Interval):
            def bound(x):
                if x == -sp.oo: return {'bound':'negative-infinity'}
                if x == sp.oo: return {'bound':'positive-infinity'}
                return adapter.from_backend(x)
            return {'setKind':'interval', 'lower':bound(item.start), 'upper':bound(item.end),
                    'lowerClosed':not item.left_open, 'upperClosed':not item.right_open}
        if isinstance(item, sp.Union):
            parts = [encode_set(part) for part in item.args]
            # Normalize ordering using stable, structural JSON (not SymPy order).
            import json
            parts.sort(key=lambda data:json.dumps(data,sort_keys=True,ensure_ascii=True))
            return {'setKind':'union', 'sets':[
                {'valueVersion':1,'kind':'set','data':part} for part in parts]}
        raise ValueError('unsupported mathematical solution set')

    try:
        data=encode_set(solution)
    except (ValueError,TypeError,NotImplementedError):
        return _failure('unsupported-operation',{'operationId':operation_id})
    return {'evaluationOutcomeVersion':1,'status':'success',
            'value':{'valueVersion':1,'kind':'set','data':data}}
