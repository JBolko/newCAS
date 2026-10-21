/** P0020 Slice 4 — descriptive classification, NOT callable resolution.
 * A collision is deliberately represented rather than silently prioritised.
 */
import {findSelectedOperationSpec} from '../operations/selected-operation-catalog.js';
import {resolveBlockSourceName} from './analyze-source-blocks.js';

export function classifyBlockCallTargets(analysis, derivedBindings) {
  if (!analysis || !Array.isArray(analysis.entries) || !Array.isArray(analysis.writers) ||
      !derivedBindings || !Array.isArray(derivedBindings.blocks) ||
      analysis.taskScopeId !== derivedBindings.taskScopeId) {
    throw new TypeError('expected matching block analysis and derived bindings');
  }
  const result = derivedBindings.blocks.map(block => {
    const entry = analysis.entries.find(e => e.blockId === block.blockId);
    if (!entry) throw new TypeError('derived block missing from analysis');
    if (!Array.isArray(block.callTargets)) throw new TypeError('missing call targets');
    if (entry.parseError !== null) {
      if (block.callTargets.length) throw new TypeError('invalid source cannot have call targets');
      return Object.freeze({blockId:block.blockId, calls:Object.freeze([])});
    }
    const lexicalTargets = block.lexicalCallTargets ?? [];
    if (!Array.isArray(lexicalTargets)) throw new TypeError('invalid lexical call targets');
    const lexicalCalls = lexicalTargets.map(name => {
      if (typeof name !== 'string' || !name) throw new TypeError('invalid lexical callable name');
      return Object.freeze({name,candidates:Object.freeze(['lexical-binder']),
        providerId:null,classification:'lexical-binder'});
    });
    const calls = [...lexicalCalls, ...block.callTargets.map(name => {
      if (typeof name !== 'string' || !name) throw new TypeError('invalid callable name');
      const operation = findSelectedOperationSpec(name);
      const binding = resolveBlockSourceName(analysis,block.blockId,name);
      const providerId = binding.kind === 'provider-reference' ? binding.providerId : null;
      const candidates = Object.freeze([
        ...(operation ? ['operation'] : []),
        ...(providerId !== null ? ['document-writer'] : []),
      ]);
      return Object.freeze({name,candidates,providerId,
        // 'ambiguous' is intentionally not an implicit name priority policy.
        classification:candidates.length === 2 ? 'ambiguous'
          : candidates.length === 1 ? candidates[0] : 'unresolved'});
    })];
    return Object.freeze({blockId:block.blockId,calls:Object.freeze(calls)});
  });
  return Object.freeze({taskScopeId:analysis.taskScopeId,blocks:Object.freeze(result)});
}
