/** P0021 Slice 26: document-owned lexical binders for Peggy FunctionDefinition.
 * Compile only; no evaluation, function invocation, or Python scope.
 */
import { LexicalIdentityScope, binderIdentity } from './identity.js';
import { defineFunction, isSemanticIRNode } from './semantic-ir.js';
import { compileSelectedSourceAst } from './compile-selected-source-ast.js';

const NAME = /^[a-zA-ZæøåÆØÅ_][a-zA-ZæøåÆØÅ0-9_]*$/u;
function fail(message) { throw new TypeError(`P0021 function source: ${message}`); }
export function compileSelectedFunctionDefinition(ast, {
  writerId, taskScopeId, specs, resolveVariable, makeBinderId,
  lexicalScope = null, makeLocalId, resolveCallable = null,
} = {}) {
  if (Array.isArray(ast)) {
    if (ast.length !== 1) fail('exactly one function definition required');
    [ast] = ast;
  }
  if (ast?.type !== 'FunctionDefinition') fail('FunctionDefinition required');
  if (typeof writerId !== 'string' || !writerId) fail('document writerId required');
  if (typeof taskScopeId !== 'string' || !taskScopeId) fail('document taskScopeId required');
  if (!NAME.test(ast.name ?? '')) fail('invalid function name');
  if (!Array.isArray(ast.params) || ast.params.length === 0) fail('parameters required');
  if (new Set(ast.params).size !== ast.params.length || ast.params.some(p => typeof p !== 'string' || !NAME.test(p)))
    fail('parameters must be unique canonical names');
  if (typeof makeBinderId !== 'function') fail('document-owned binder identity supplier required');
  if (lexicalScope !== null && !(lexicalScope instanceof LexicalIdentityScope)) fail('invalid lexical scope');
  const ids = ast.params.map((name, index) => binderIdentity(makeBinderId({writerId,index,name}),name));
  if (new Set(ids.map(x => x.id)).size !== ids.length) fail('duplicate binder identity');
  const scope = (lexicalScope ?? new LexicalIdentityScope(taskScopeId)).push(ids);
  const body = compileSelectedSourceAst(ast.body, {specs, resolveVariable, lexicalScope:scope, makeLocalId, resolveCallable});
  if (!isSemanticIRNode(body)) fail('invalid function body');
  return defineFunction(writerId,ids,body);
}
