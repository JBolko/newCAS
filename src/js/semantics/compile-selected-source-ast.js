/** P0021 Slice 19. Compile a *Peggy-produced* expression AST to selected IR.
 * No parsing, scope lookup, Python generation, or implicit capability selection.
 * Operator/function names are only lookup keys in the caller-provided catalog.
 */
import { isOperationSpec } from '../operations/operation-spec.js';
import { planOperationArguments } from './operation-argument-plan.js';
import { resolveSelectedOperationCall } from './resolve-selected-operation-call.js';
import { LexicalIdentityScope } from './identity.js';
import { operationReference, semanticReference, call, isSemanticIRNode } from './semantic-ir.js';
import {createSelectedArithmeticLowering} from './lower-selected-arithmetic.js';
import {lowerSourceExpressionTree} from './lower-source-expression-tree.js';

const SOURCE_NAME = /^[a-zA-ZæøåÆØÅ_][a-zA-ZæøåÆØÅ0-9_]*$/u;
function reject(message) { throw new TypeError(`P0021 source AST: ${message}`); }
export function compileSelectedSourceAst(ast, { specs, resolveVariable: resolveVariableFromDocument, lexicalScope = null, makeLocalId, resolveCallable = null } = {}) {
  if (!(specs instanceof Map)) reject('explicit OperationSpec map required');
  if (lexicalScope !== null && !(lexicalScope instanceof LexicalIdentityScope))
    reject('expected caller-owned LexicalIdentityScope');
  const selected = (name, argumentsIR) => {
    const spec = specs.get(name);
    if (!isOperationSpec(spec) || spec.operationId !== name) reject(`unselected operation ${name}`);
    const plan = planOperationArguments(spec, argumentsIR.length);
    if (plan.status !== 'selected' || plan.arguments.some(a => a.role !== 'value'))
      reject(`operation ${name} requires unsupported arity or argument roles`);
    return call(operationReference(spec.operationId), argumentsIR);
  };
  // Shared arithmetic lowering; this compiler still owns lexical/provider names.
  const arithmetic = createSelectedArithmeticLowering(selected);
  // The source compiler owns lexical identity and OperationSpec resolution.
  // Structural Peggy traversal is shared with document compilation.
  const resolveVariable = (node, scope) => {
    if (typeof node.name !== 'string' || !SOURCE_NAME.test(node.name))
      reject('invalid variable name');
    if (scope !== null) {
      const identity = scope.resolve(node.name);
      if (identity.kind !== 'free-symbol') return semanticReference(identity);
    }
    if (typeof resolveVariableFromDocument !== 'function')
      reject(`variable ${node.name} requires document-owned binding`);
    const bound = resolveVariableFromDocument(node.name);
    if (!isSemanticIRNode(bound) ||
        (bound.kind !== 'provider-reference' && bound.kind !== 'semantic-reference'))
      reject(`variable ${node.name} requires provider-reference or semantic-reference`);
    return bound;
  };
  const resolveCall = (node, scope, visit) => {
    if (typeof node.name !== 'string' || !Array.isArray(node.args)) reject('invalid function call');
    const spec = specs.get(node.name);
    if (!isOperationSpec(spec) || spec.operationId !== node.name) {
      // Document-owned positional call bindings are supplied explicitly, never
      // inferred from a source name or from the local lexical binder scope.
      if (typeof resolveCallable !== 'function') reject(`unselected operation ${node.name}`);
      const callee = resolveCallable(node.name);
      if (!isSemanticIRNode(callee) || callee.kind !== 'provider-reference')
        reject(`callable ${node.name} requires an attested provider-reference`);
      return call(callee, node.args.map(arg => visit(arg, scope)));
    }
    const plan = planOperationArguments(spec, node.args.length);
    if (plan.status !== 'selected') reject(`operation ${node.name} requires unsupported arity or argument roles`);
    if (plan.arguments.some(a => a.role === 'scoped'))
      reject(`operation ${node.name} requires unsupported scoped role`);
    const targets = plan.arguments.filter(a => a.role === 'symbolic');
    if (targets.length > 0) {
      if (targets.length !== 1) reject('multiple symbolic targets not supported in this slice');
      if (scope === null || typeof makeLocalId !== 'function')
        reject('symbolic role requires document-owned lexical scope and identity supplier');
      const index = plan.arguments.findIndex(a => a.role === 'symbolic');
      const target = node.args[index];
      if (target?.type === 'Variable' &&
          (typeof target.name !== 'string' || !SOURCE_NAME.test(target.name)))
        reject('invalid symbolic variable name');
      return resolveSelectedOperationCall(node, spec,
        (arg, meta) => visit(arg, meta.lexicalScope ?? scope), makeLocalId, scope);
    }
    return selected(node.name, node.args.map(arg => visit(arg, scope)));
  };
  if (Array.isArray(ast)) {
    if (ast.length !== 1) reject('exactly one parsed expression required');
    ast=ast[0];
  }
  return lowerSourceExpressionTree(ast, {
    arithmetic, resolveVariable, resolveCall, reject, context: lexicalScope,
  });
}
