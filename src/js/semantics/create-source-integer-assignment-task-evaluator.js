/** P0021 Slice 52: source-attested integer assignment, not a Python scope. */
import {createValueEvaluator} from './create-value-evaluator.js';
import {expression} from '../values/value.js';
const fail=message=>{throw new TypeError(`P0021 integer assignment: ${message}`);};
export function createSourceIntegerAssignmentTaskEvaluator({snapshot,blockId,expectedName,parse,getProviderOutcome,revision}={}) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || typeof blockId!=='string' || !blockId ||
      typeof expectedName!=='string' || !expectedName || typeof parse!=='function') fail('source attestation required');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope=>{
    if(envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId || envelope.providers.length!==0)
      fail('assignment task identity or provider mismatch');
    const entries=snapshot.blocks.filter(b=>b.blockId===blockId);
    if(entries.length!==1 || entries[0].parseError!==null) fail('unique parsed document block required');
    const writer=snapshot.writers?.find(w=>w.writerId===blockId && w.name===expectedName && w.taskScopeId===snapshot.taskScopeId);
    if(!writer) fail('attested assignment writer required');
    const ast=parse(envelope.source);
    if(!Array.isArray(ast)||ast.length!==1 || ast[0]?.type!=='Assignment' || ast[0].name!==expectedName ||
       ast[0].value?.type!=='Literal' || !Number.isSafeInteger(ast[0].value.value))
      fail('only a single integer-literal assignment is supported');
    return {blockId,status:'success',value:expression({op:'integer',value:String(ast[0].value.value)})};
  }});
}
