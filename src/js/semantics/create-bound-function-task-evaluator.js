/** P0021 Slice 32: bridge a document-attested source function call into the
 * existing Slice 7 Value gateway / Slice 6 sequential batch dispatcher.
 * Caller supplies current-revision provider outcomes and already materialized
 * argument Values. No name lookup, cache, or revision authority is added here.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {evaluateBoundSourceFunctionCall} from './evaluate-bound-source-function-call.js';
import {isValue} from '../values/value.js';

export function createBoundFunctionTaskEvaluator({
  snapshot,blockId,callIndex=0,expectedName,args,specs,evaluate,
  getProviderOutcome,revision,
}={}) {
  if (!snapshot || typeof blockId!=='string' || !blockId ||
      typeof expectedName!=='string' || !expectedName ||
      !Array.isArray(args) || args.some(v=>!isValue(v)) ||
      !(specs instanceof Map) || typeof evaluate!=='function') {
    throw new TypeError('P0021 bound function task: explicit snapshot, call, Values and selected evaluator required');
  }
  // The Slice 7 gateway verifies each provider is an outcome of precisely the
  // bound upstream block. The Slice 6 dispatcher governs revision and commit.
  return createValueEvaluator({revision,getProviderOutcome,
    invoke:async envelope=>{
      if (envelope.blockId!==blockId) throw new TypeError('P0021 bound function task: wrong scheduled block');
      const value=await evaluateBoundSourceFunctionCall({
        snapshot,blockId,callIndex,expectedName,args,envelope,specs,evaluate,
      });
      return {blockId,status:'success',value};
    },
  });
}
