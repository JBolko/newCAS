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
    const callFacts = matched[0].calls ?? [];
    // Built-in operations are resolved by OperationSpec. Calls to document
    // functions must have one unambiguous positional provider attestation.
    const callableFacts = callFacts.filter(c => c.classification === 'document-writer');
    if (callFacts.some(c => c.classification !== 'operation' && c.classification !== 'document-writer'))
      fail('unresolved or ambiguous function call');
    const bindings = [
      ...referenceFacts.map(ref => ({name:ref.name,providerId:ref.binding?.providerId,kind:'variable'})),
      ...callableFacts.map(call => ({name:call.name,providerId:call.providerId,kind:'function'})),
    ];
    if (bindings.some(binding => !binding.providerId) ||
        new Set(bindings.map(b => b.name)).size !== bindings.length ||
        new Set(bindings.map(b => b.providerId)).size !== bindings.length ||
        envelope.providers.length !== bindings.length)
      fail('capture provider metadata mismatch');
    const captures = bindings.map(binding => {
      const candidates = envelope.providers.filter(p => p.name === binding.name && p.providerId === binding.providerId);
      const expectedKind = binding.kind === 'function' ? 'function' : 'expression';
      if (candidates.length !== 1 || !isValue(candidates[0].value) || candidates[0].value.kind !== expectedKind)
        fail('capture provider identity or Value kind mismatch');
      return {providerId:binding.providerId,
        identity:freeSymbolIdentity(envelope.taskScopeId,binding.name),value:candidates[0].value};
    });
    const variableCaptures = captures.filter(c=>c.value.kind === 'expression');
    const callableCaptures = new Map(captures.filter(c=>c.value.kind === 'function')
      .map(c=>[c.identity.name,c.providerId]));
    const ast = parse(envelope.source);
    if (!Array.isArray(ast) || ast.length !== 1 || ast[0]?.type !== 'FunctionDefinition' ||
        ast[0].name !== expectedName) fail('source function writer does not match expected name');
    const writer = snapshot.writers?.find(w => w.writerId === blockId && w.name === expectedName);
    if (!writer) fail('definition is not an attested document writer');
    const ir = compileSelectedFunctionDefinition(ast, {
      writerId:blockId, taskScopeId:envelope.taskScopeId, specs,
      makeBinderId:({writerId,index})=>`${envelope.taskScopeId}:${writerId}:param:${index}`,
      resolveVariable:name=>{
        const selected = variableCaptures.find(c=>c.identity.name===name);
        if (!selected) fail('free variable without analyzed capture');
        return providerReference(selected.providerId);
      },
      resolveCallable:name=>{
        const providerId=callableCaptures.get(name);
        if (!providerId) fail('function name without analyzed callable capture');
        return providerReference(providerId);
      },
    });
    const value = materializeSelectedFunctionValue(ir,{captures});
    return {blockId,status:'success',value};
  }});
}
