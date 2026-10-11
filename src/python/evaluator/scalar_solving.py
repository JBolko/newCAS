"""Selected, bounded equality solver for explicit real/complex domains."""
import sympy as sp
from src.python.adapters.sympy_value_adapter import SympyValueAdapter
from src.python.evaluator._binary_expression_contract import _failure

_CAPABILITY = 'probe.symbolic.solve'


def evaluate_solve_request(request, operation_spec):
    if not isinstance(request, dict) or not isinstance(operation_spec, dict):
        raise ValueError('request and selected spec required')
    if request.get('evaluationRequestVersion') != 1 or operation_spec.get('operationSpecVersion') != 1:
        raise ValueError('invalid contract version')
    operation_id = operation_spec.get('operationId')
    if not isinstance(operation_id, str) or not operation_id:
        raise ValueError('operationId required')
    evaluator_id = request.get('evaluatorId')
    if not isinstance(evaluator_id, str) or not evaluator_id:
        raise ValueError('evaluatorId required')
    if evaluator_id != operation_spec.get('evaluatorId') or evaluator_id != _CAPABILITY:
        return _failure('unsupported-operation', {'operationId': operation_id})
    if request.get('instruction') != {}:
        raise ValueError('current solve signature requires empty instruction')
    options = request.get('options')
    if not isinstance(options, dict) or set(options) not in (set(), {'domain'}):
        raise ValueError('solve options must be empty or carry only domain')
    domain_name = options.get('domain', 'real')
    if domain_name not in ('real', 'complex'):
        return _failure('unsupported-operation', {'operationId': operation_id})
    domain = sp.S.Reals if domain_name == 'real' else sp.S.Complexes
    signatures = operation_spec.get('signatures')
    if not isinstance(signatures, list) or len(signatures) != 1:
        raise ValueError('one selected solve signature required')
    args = signatures[0].get('arguments') if isinstance(signatures[0], dict) else None
    if not isinstance(args, list) or len(args) != 2 or any(not isinstance(a, dict) or not isinstance(a.get('name'),str) or not a['name'] for a in args):
        raise ValueError('invalid solve signature')
    if [a.get('role') for a in args] != ['value', 'symbolic']:
        raise ValueError('solve expects roles value, symbolic')
    values = request.get('inputs')
    if not isinstance(values, list):
        raise ValueError('inputs must be Values')
    if len(values) != 2:
        return _failure('wrong-arity', {'operationId':operation_id,'expected':[2],'actual':len(values)})
    relation,target = values
    if not isinstance(relation,dict) or relation.get('kind') != 'relation' or not isinstance(relation.get('data'),dict) or relation['data'].get('operator') != 'eq':
        return _failure('type-mismatch', {'operationId':operation_id,'argument':args[0]['name'],'expectedKinds':['equality-relation'],'actualKind':str(relation.get('kind','unknown') if isinstance(relation,dict) else 'unknown')})
    if not isinstance(target,dict) or target.get('kind') != 'expression' or not isinstance(target.get('data'),dict) or not isinstance(target['data'].get('expr'),dict) or target['data']['expr'].get('op') != 'symbolRef':
        return _failure('type-mismatch', {'operationId':operation_id,'argument':args[1]['name'],'expectedKinds':['symbol-reference'],'actualKind':'non-symbol-reference'})
    left,right=relation['data'].get('left'),relation['data'].get('right')
    if not all(isinstance(v,dict) and v.get('kind')=='expression' for v in (left,right)):
        return _failure('type-mismatch', {'operationId':operation_id,'argument':args[0]['name'],'expectedKinds':['equality-of-expressions'],'actualKind':'invalid-relation-operands'})
    adapter=SympyValueAdapter()
    lhs=adapter.to_backend(left); rhs=adapter.to_backend(right)
    var=adapter.to_backend(target)
    if not isinstance(var,sp.Symbol):
        raise ValueError('symbolic target did not resolve to symbol')
    solution=sp.solveset(lhs-rhs,var,domain=domain)
    if solution is sp.S.EmptySet:
        result={'setKind':'empty'}
    elif isinstance(solution,sp.FiniteSet):
        result={'setKind':'finite','items':[adapter.from_backend(x) for x in sorted(solution,key=sp.default_sort_key)]}
    else:
        # Do not disguise symbolic/conditional/infinite solution families as finite sets.
        return _failure('unsupported-operation', {'operationId': operation_id})
    return {'evaluationOutcomeVersion':1,'status':'success','value':{'valueVersion':1,'kind':'set','data':result}}
