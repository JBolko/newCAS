/** P0021 Slice 90a — proposed statement-level source-analysis adapter.
 *
 * Takes the canonical parser's COMPLETE Program AST and projects each
 * statement as a virtual semantic position, preserving parent-block order.
 * It reuses P0020 writer establishment/name resolution and snapshot derivation;
 * it does NOT mutate DocumentRuntime, create another runtime, materialize
 * Values, or dispatch evaluation. This is intentionally not activated yet.
 *
 * IDs are private derived identities, NOT persistence IDs. Structural edits
 * may renumber them; DocumentRuntime must own invalidation before integration.
 */
import { establishSourceWriters } from './establish-source-writers.js';
import { snapshotFromSourceAnalysis } from './derive-source-semantic-snapshot.js';

function statementId(parentBlockId, statementIndex) {
  // Injective for all valid strings/indices. Never split or interpret block IDs.
  return JSON.stringify([parentBlockId, statementIndex]);
}

export function analyzeSequentialSourceBlocks(blocks, parse, taskScopeId) {
  if (!Array.isArray(blocks) || typeof parse !== 'function' ||
      typeof taskScopeId !== 'string' || !taskScopeId) {
    throw new TypeError('blocks, parser and taskScopeId required');
  }
  const seenIds = new Set();
  const entries = [];
  const writers = [];

  for (const block of blocks) {
    if (!block || typeof block.id !== 'string' || !block.id ||
        typeof block.source !== 'string' || seenIds.has(block.id)) {
      throw new TypeError('unique block id and string source required');
    }
    seenIds.add(block.id);

    let program = null;
    let parseError = null;
    try {
      program = parse(block.source);
      // Validate the whole Program BEFORE establishing even the first writer.
      if (!Array.isArray(program) || program.length === 0 ||
          program.some(node => !node || typeof node !== 'object' ||
            Array.isArray(node) || typeof node.type !== 'string')) {
        parseError = 'Expected nonempty, well-formed statement program';
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    if (parseError !== null) {
      // One local invalid entry; never partially expose writers from this block.
      entries.push(Object.freeze({
        blockId: statementId(block.id, 0), parentBlockId: block.id,
        statementIndex: 0, position: entries.length, ast: null, parseError,
      }));
      continue;
    }
    for (let statementIndex = 0; statementIndex < program.length; statementIndex++) {
      const blockId = statementId(block.id, statementIndex);
      const position = entries.length;
      const ast = Object.freeze([program[statementIndex]]);
      writers.push(...establishSourceWriters(ast, {
        writerId: blockId, taskScopeId, position,
      }));
      entries.push(Object.freeze({
        blockId, parentBlockId: block.id, statementIndex,
        position, ast, parseError: null,
      }));
    }
  }
  return Object.freeze({
    taskScopeId,
    entries: Object.freeze(entries),
    writers: Object.freeze(writers),
  });
}

export function deriveSequentialSourceSemanticSnapshot(blocks, parse, taskScopeId) {
  const analysis = analyzeSequentialSourceBlocks(blocks, parse, taskScopeId);
  // Exactly the same binding/call-target logic used by single-statement v1.
  const snapshot = snapshotFromSourceAnalysis(analysis);
  const positions = Object.freeze(analysis.entries.map(entry => Object.freeze({
    statementId: entry.blockId,
    parentBlockId: entry.parentBlockId,
    statementIndex: entry.statementIndex,
    position: entry.position,
  })));
  return Object.freeze({analysis, snapshot, positions});
}
