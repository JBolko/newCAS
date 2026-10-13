/** P0021 Slice 43 — source-attested integer argument function-call bridge.
 * P0020 owns callable selection; this adapter does not resolve names or retain
 * document state. No fallback to a later writer on unresolved calls.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {evaluateBoundSourceFunctionCall} from './evaluate-bound-source-function-call.js';
import {expression} from '../values/value.js';

const fail = message => { throw new TypeError(`P0021 source literal function: ${message}`); };
export function createSourceLiteralFunctionTaskEvaluator({
  snapshot,blockId,callIndex=0,expectedName,parse,specs,evaluate,getProviderOutcome,revision,
}={}) {
  if (!snapshot || typeof blockId!=='string' || !blockId ||
      typeof expectedName!=='string' || !expectedName ||
      typeof parse!=='function' || !(specs instanceof Map) || typeof evaluate!=='function')
    fail('explicit source attestation and evaluator required');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope=>{
    if (envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId)
      fail('document task mismatch');
    const entry=snapshot.blocks?.filter(b=>b.blockId===blockId);
    if (entry?.length!==1 || entry[0].parseError!==null) fail('unique parsed source required');
    const ast=parse(envelope.source);
    if (!Array.isArray(ast) || ast.length!==1 || ast[0]?.type!=='FunctionCall' ||
        ast[0].name!==expectedName || ast[0].args?.length!==1 ||
        ast[0].args[0]?.type!=='Literal' || !Number.isSafeInteger(ast[0].args[0].value))
      fail('one source integer-literal argument required');
    const value=await evaluateBoundSourceFunctionCall({
      snapshot,blockId,callIndex,expectedName,
      args:[expression({op:'integer',value:String(ast[0].args[0].value)})],
      envelope,specs,evaluate,
    });
    return {blockId,status:'success',value};
  }});
}
