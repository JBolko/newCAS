/** P0021 Slice 75 — bridge the existing P0020 task gateway to resolved IR.
 * Experimental/opt-in: DocumentRuntime and the active batch remain authoritative.
 * No source-name lookup occurs after compilation; no second provider registry.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {compileAttestedDocumentExpressionIR} from './compile-attested-document-expression-ir.js';
import {evaluateAttestedDocumentIR} from './evaluate-attested-document-ir.js';

const fail = message => {throw new TypeError(`P0021 attested IR task: ${message}`);};
export function createAttestedIRTaskEvaluator({snapshot,blockId,parse,specs,evaluate,applyFunction,getProviderOutcome,revision}={}) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || !Array.isArray(snapshot.writers) ||
      typeof blockId!=='string' || !blockId || typeof parse!=='function' ||
      !(specs instanceof Map) || typeof evaluate!=='function' || typeof applyFunction!=='function')
    fail('snapshot, block identity, parser, specs and evaluators required');
  const entry=snapshot.blocks.find(b=>b.blockId===blockId);
  if(!entry)fail('block absent from attested task');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope=>{
    if(envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId)
      fail('task scope mismatch');
    const statements=parse(envelope.source);
    if(!Array.isArray(statements) || statements.length!==1)fail('single source statement required');
    const ir=compileAttestedDocumentExpressionIR(statements[0],{entry,blockId,specs,writers:snapshot.writers});
    const value=await evaluateAttestedDocumentIR({ir,envelope,specs,evaluate,applyFunction});
    return {blockId,status:'success',value};
  }});
}
