/** P0021 Slice 50: source-attested, capture-free FunctionValue writer.
 * DocumentRuntime owns source/order; P0020 owns writer selection; this is only
 * an evaluator callback for the existing P0021 dispatcher.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {compileSelectedFunctionDefinition} from './compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from './materialize-selected-function-value.js';
import {freeSymbolIdentity} from './identity.js';
import {providerReference} from './semantic-ir.js';
import {isValue} from '../values/value.js';

const fail = msg => { throw new TypeError(`P0021 source function writer: ${msg}`); };

export function createSourceFunctionDefinitionTaskEvaluator({
  snapshot, blockId, expectedName, parse, specs, getProviderOutcome, revision,
} = {}) {
  if (!snapshot || typeof snapshot.taskScopeId !== 'string' || !snapshot.taskScopeId ||
      typeof blockId !== 'string' || !blockId || typeof expectedName !== 'string' || !expectedName ||
      typeof parse !== 'function' || !(specs instanceof Map)) fail('explicit task, source and operation catalog required');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope => {
    if (envelope.blockId !== blockId || envelope.taskScopeId !== snapshot.taskScopeId)
      fail('document task identity mismatch');
    const matched = snapshot.blocks?.filter(b => b.blockId === blockId);
    if (matched?.length !== 1 || matched[0].parseError !== null) fail('unique parsed document block required');
    // Attest captures against P0020's positional source bindings, not names alone.
    const referenceFacts = matched[0].references ?? [];
    if (envelope.providers.length !== referenceFacts.length) fail('capture provider count mismatch');
    const captures = referenceFacts.map(ref => {
      if (ref.binding?.kind !== 'provider-reference') fail('unresolved free capture');
      const candidates = envelope.providers.filter(p => p.name === ref.name && p.providerId === ref.binding.providerId);
      if (candidates.length !== 1 || !isValue(candidates[0].value) || candidates[0].value.kind !== 'expression')
        fail('capture provider identity or Value mismatch');
      return {providerId:ref.binding.providerId, identity:freeSymbolIdentity(envelope.taskScopeId,ref.name),value:candidates[0].value};
    });
    if (new Set(captures.map(c => c.providerId)).size !== captures.length) fail('duplicate capture provider');
    const ast = parse(envelope.source);
    if (!Array.isArray(ast) || ast.length !== 1 || ast[0]?.type !== 'FunctionDefinition' ||
        ast[0].name !== expectedName) fail('source function writer does not match expected name');
    const writer = snapshot.writers?.find(w => w.writerId === blockId && w.name === expectedName);
    if (!writer) fail('definition is not an attested document writer');
    const ir = compileSelectedFunctionDefinition(ast, {
      writerId:blockId, taskScopeId:envelope.taskScopeId, specs,
      makeBinderId:({writerId,index})=>`${envelope.taskScopeId}:${writerId}:param:${index}`,
      resolveVariable:name=>{
        const selected = captures.find(c=>c.identity.name===name);
        if (!selected) fail('free variable without analyzed capture');
        return providerReference(selected.providerId);
      },
    });
    const value = materializeSelectedFunctionValue(ir,{captures});
    return {blockId,status:'success',value};
  }});
}
