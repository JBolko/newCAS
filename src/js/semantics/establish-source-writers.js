/** P0020 Slice 1: establish document writer descriptors from a parsed AST.
 * The parser must have accepted the *complete* source before this is called.
 * No document mutation, evaluation or success-dependent fallback.
 */
const NAME = /^[a-zA-ZæøåÆØÅ_][a-zA-ZæøåÆØÅ0-9_]*$/u;

export function establishSourceWriters(ast, {writerId, taskScopeId, position} = {}) {
  if (typeof writerId !== 'string' || !writerId ||
      typeof taskScopeId !== 'string' || !taskScopeId ||
      !Number.isSafeInteger(position) || position < 0) {
    throw new TypeError('writer identity, task scope and position required');
  }
  // Only a single parsed source statement establishes a writer here.
  // Multi-statement blocks need an explicit positional model in a later slice.
  if (Array.isArray(ast)) {
    if (ast.length !== 1) return Object.freeze([]);
    ast = ast[0];
  }
  if (!ast || typeof ast !== 'object') return Object.freeze([]);
  if (ast.type !== 'Assignment' && ast.type !== 'FunctionDefinition') {
    return Object.freeze([]);
  }
  if (typeof ast.name !== 'string' || !NAME.test(ast.name)) {
    return Object.freeze([]);
  }
  if (ast.type === 'Assignment') {
    if (!ast.value || typeof ast.value !== 'object') return Object.freeze([]);
  } else {
    if (!Array.isArray(ast.params) || !ast.body || typeof ast.body !== 'object' ||
        ast.params.some(p => typeof p !== 'string' || !NAME.test(p)) ||
        new Set(ast.params).size !== ast.params.length) return Object.freeze([]);
  }
  return Object.freeze([Object.freeze({
    writerId, taskScopeId, position, name:ast.name, established:true,
  })]);
}
