/** P0021 Slice 40: bounded document-sourced f(x) bridge.
 * P0020 attests callable and argument providers; the existing P0021 gateway
 * obtains their CURRENT revision Values. No runtime name resolution or scope.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {evaluateBoundSourceFunctionCall} from './evaluate-bound-source-function-call.js';
import {isValue} from '../values/value.js';

const fail = message => { throw new TypeError(`P0021 source argument function: ${message}`); };
export function createSourceVariableFunctionTaskEvaluator({
  snapshot,blockId,callIndex=0,expectedName,parse,specs,evaluate,getProviderOutcome,revision,
}={}) {
  if (!snapshot || typeof blockId!=='string' || !blockId ||
      typeof expectedName!=='string' || !expectedName || typeof parse!=='function' ||
      !(specs instanceof Map) || typeof evaluate!=='function') fail('explicit document selection and evaluator required');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope=>{
    if(envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId) fail('document task mismatch');
    const blocks=snapshot.blocks?.filter(b=>b.blockId===blockId);
    if(blocks?.length!==1 || blocks[0].parseError!==null) fail('unique parsed document block required');
    const selected=blocks[0].calls?.[callIndex];
    if(!selected || selected.name!==expectedName || selected.classification!=='document-writer' ||
       selected.candidates?.length!==1 || selected.candidates[0]!=='document-writer') fail('unambiguous analyzed callable required');
    const ast=parse(envelope.source);
    if(!Array.isArray(ast)||ast.length!==1||ast[0]?.type!=='FunctionCall'||
       ast[0].name!==expectedName||ast[0].args?.length!==1||ast[0].args[0]?.type!=='Variable')
      fail('single source f(variable) call required');
    const argumentName=ast[0].args[0].name;
    const refs=blocks[0].references?.filter(r=>r.name===argumentName);
    if(refs?.length!==1 || refs[0].binding?.kind!=='provider-reference')
      fail('argument must have an analyzed document provider');
    const argumentId=refs[0].binding.providerId;
    if(argumentId===selected.providerId) fail('callable and argument provider collision');
    if(envelope.providers.length!==2) fail('exactly selected function and argument providers required');
    const fn=envelope.providers.find(p=>p.name===expectedName && p.providerId===selected.providerId);
    const arg=envelope.providers.find(p=>p.name===argumentName && p.providerId===argumentId);
    if(!fn||!arg||!isValue(arg.value)) fail('source provider attestation failed');
    const functionEnvelope=Object.freeze({...envelope,providers:Object.freeze([fn])});
    const value=await evaluateBoundSourceFunctionCall({
      snapshot,blockId,callIndex,expectedName,args:[arg.value],envelope:functionEnvelope,specs,evaluate,
    });
    return {blockId,status:'success',value};
  }});
}
