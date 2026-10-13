/** P0020 Slice 5: compose one derived snapshot from one source analysis.
 * Does not evaluate mathematics, change DocumentRuntime, or decide ambiguous
 * callable name priority. Keeps the shared derived facts tied to same blocks.
 */
import {analyzeSourceBlocks} from './analyze-source-blocks.js';
import {deriveBlockSourceBindings} from './derive-block-source-bindings.js';
import {classifyBlockCallTargets} from './classify-call-targets.js';

export function deriveSourceSemanticSnapshot(blocks, parse, taskScopeId) {
  const analysis = analyzeSourceBlocks(blocks, parse, taskScopeId);
  const bindings = deriveBlockSourceBindings(analysis);
  const calls = classifyBlockCallTargets(analysis, bindings);
  const entries = analysis.entries.map((entry, i) => {
    const derived = bindings.blocks[i];
    const classified = calls.blocks[i];
    if (entry.blockId !== derived?.blockId || entry.blockId !== classified?.blockId) {
      throw new TypeError('semantic block alignment violated');
    }
    return Object.freeze({
      blockId: entry.blockId,
      position: entry.position,
      parseError: entry.parseError,
      references: derived.references,
      calls: classified.calls,
    });
  });
  return Object.freeze({
    taskScopeId: analysis.taskScopeId,
    writers: analysis.writers,
    blocks: Object.freeze(entries),
  });
}
