// P0019 slice 4: pure, positional source-name binding boundary.
// Writers supplied here must already have passed syntax/structural checks.
// This does not construct writers, interpret document order from execution,
// resolve materialized Values, or evaluate anything.
import { LexicalIdentityScope } from './identity.js';
import { providerReference, semanticReference } from './semantic-ir.js';

export function resolvePositionalName({
  name, position, taskScopeId, writers, lexicalScope = null,
}) {
  if (typeof name !== 'string' || !name ||
      typeof taskScopeId !== 'string' || !taskScopeId ||
      !Number.isSafeInteger(position) || position < 0 ||
      !Array.isArray(writers) ||
      (lexicalScope !== null && !(lexicalScope instanceof LexicalIdentityScope))) {
    throw new TypeError('invalid positional source name lookup');
  }
  // Lexical binders and operation-local targets override document writers.
  if (lexicalScope !== null) {
    const identity = lexicalScope.resolve(name);
    if (identity.kind !== 'free-symbol') return semanticReference(identity);
  }
  let winner = null;
  for (const writer of writers) {
    if (!writer || typeof writer !== 'object' ||
        typeof writer.writerId !== 'string' || !writer.writerId ||
        typeof writer.name !== 'string' || !writer.name ||
        typeof writer.taskScopeId !== 'string' || !writer.taskScopeId ||
        !Number.isSafeInteger(writer.position) || writer.position < 0 ||
        typeof writer.established !== 'boolean') {
      throw new TypeError('invalid writer descriptor');
    }
    if (writer.established && writer.taskScopeId === taskScopeId &&
        writer.name === name && writer.position < position &&
        (winner === null || writer.position > winner.position)) {
      winner = writer;
    }
  }
  // Failed or unavailable Values MUST NOT trigger fallback to older writers.
  if (winner !== null) return providerReference(winner.writerId);
  const scope = lexicalScope ?? new LexicalIdentityScope(taskScopeId);
  return semanticReference(scope.resolve(name));
}
