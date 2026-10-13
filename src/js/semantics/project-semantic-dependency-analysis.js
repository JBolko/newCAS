/** P0021 Slice 1: project a P0020 semantic snapshot into graph/binding facts.
 * Provider bindings come from snapshot.blocks[].references[].binding only.
 * No source reparsing, writer selection, Python scope, or runtime mutation.
 */
import { DependencyGraph } from '../dependency-graph.js';

export function projectSemanticDependencyAnalysis(snapshot) {
  if (!snapshot || typeof snapshot.taskScopeId !== 'string' || !snapshot.taskScopeId ||
      !Array.isArray(snapshot.blocks) || !Array.isArray(snapshot.writers)) {
    throw new TypeError('expected P0020 derived semantic snapshot');
  }
  const graph = new DependencyGraph();
  const bindings = new Map();
  const knownBlocks = new Set();
  for (const block of snapshot.blocks) {
    if (!block || typeof block.blockId !== 'string' || !block.blockId ||
        knownBlocks.has(block.blockId) || !Array.isArray(block.references)) {
      throw new TypeError('invalid semantic snapshot block');
    }
    knownBlocks.add(block.blockId);
    graph.addNode(block.blockId);
  }
  for (const block of snapshot.blocks) {
    const blockBindings = new Map();
    if (block.parseError !== null && block.references.length !== 0) {
      throw new TypeError('invalid parsed block has derived source references');
    }
    for (const ref of block.references) {
      if (!ref || typeof ref.name !== 'string' || !ref.name ||
          blockBindings.has(ref.name) || !ref.binding || typeof ref.binding !== 'object') {
        throw new TypeError('invalid or duplicate source reference');
      }
      const binding = ref.binding;
      if (binding.kind === 'provider-reference') {
        if (typeof binding.providerId !== 'string' || !knownBlocks.has(binding.providerId)) {
          throw new TypeError('dangling provider reference');
        }
        blockBindings.set(ref.name, binding.providerId);
        graph.addEdge(binding.providerId, block.blockId);
      } else if (binding.kind !== 'semantic-reference') {
        throw new TypeError('unsupported semantic binding kind');
      }
    }
    bindings.set(block.blockId, blockBindings);
  }
  // Same graph/bindings interface used by the existing document dependency
  // analysis, but this is a separate pure projection until DocumentRuntime
  // migration is tested.
  return {graph, bindings};
}
