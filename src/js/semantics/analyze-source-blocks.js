/** P0020 Slice 2: bounded glue for real parsed source blocks.
 * Parse completion precedes writer establishment. Positions are block indices.
 * Does not evaluate, mutate DocumentRuntime, or derive success from availability.
 */
import { establishSourceWriters } from './establish-source-writers.js';
import { resolvePositionalName } from './resolve-positional-name.js';

export function analyzeSourceBlocks(blocks, parse, taskScopeId) {
  if (!Array.isArray(blocks) || typeof parse !== 'function' ||
      typeof taskScopeId !== 'string' || !taskScopeId) {
    throw new TypeError('blocks, parser and taskScopeId required');
  }
  const seenIds = new Set();
  const entries = [];
  const writers = [];
  for (let position = 0; position < blocks.length; position++) {
    const block = blocks[position];
    if (!block || typeof block.id !== 'string' || !block.id ||
        typeof block.source !== 'string' || seenIds.has(block.id)) {
      throw new TypeError('unique block id and string source required');
    }
    seenIds.add(block.id);
    let ast = null;
    let parseError = null;
    try {
      ast = parse(block.source); // must consume the complete source
    } catch (error) {
      // Syntax failure: no writer. Keep failure in this derived analysis,
      // not an authoritative document change or a fabricated Value.
      parseError = error instanceof Error ? error.message : String(error);
    }
    if (parseError === null) {
      const established = establishSourceWriters(ast, {
        writerId: block.id, taskScopeId, position,
      });
      writers.push(...established);
    }
    entries.push(Object.freeze({
      blockId:block.id, position, ast, parseError,
    }));
  }
  const frozenWriters = Object.freeze(writers);
  return Object.freeze({
    taskScopeId,
    entries:Object.freeze(entries),
    writers:frozenWriters,
  });
}

export function resolveBlockSourceName(analysis, blockId, name, lexicalScope = null) {
  if (!analysis || !Array.isArray(analysis.entries) || !Array.isArray(analysis.writers)) {
    throw new TypeError('expected source-block analysis');
  }
  const entry = analysis.entries.find(e => e.blockId === blockId);
  if (!entry) throw new TypeError('unknown block');
  if (entry.parseError !== null) {
    throw new TypeError('cannot resolve names from invalid source block');
  }
  return resolvePositionalName({
    name, position:entry.position, taskScopeId:analysis.taskScopeId,
    writers:analysis.writers, lexicalScope,
  });
}
