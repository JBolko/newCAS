/** P0021 Slice 19. Compile a *Peggy-produced* expression AST to selected IR.
 * No parsing, scope lookup, Python generation, or implicit capability selection.
 * Operator/function names are only lookup keys in the caller-provided catalog.
 */
import { isOperationSpec } from '../operations/operation-spec.js';
import { planOperationArguments } from './operation-argument-plan.js';
import { resolveSelectedOperationCall } from './resolve-selected-operation-call.js';
import { LexicalIdentityScope } from './identity.js';
import { expression } from '../values/value.js';
import { valueLiteral, operationReference, semanticReference, call, isSemanticIRNode } from './semantic-ir.js';

const INT = /^[0-9]+$/;
const SOURCE_NAME = /^[a-zA-ZæøåÆØÅ_][a-zA-ZæøåÆØÅ0-9_]*$/u;
function reject(message) { throw new TypeError(`P0021 source AST: ${message}`); }
const OP = Object.freeze({ '+': 'add', '*': 'multiply' });
export function compileSelectedSourceAst(ast, { specs, resolveVariable, lexicalScope = null, makeLocalId } = {}) {
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
  // Lower syntax through explicitly selected existing operations, never by
  // evaluating a signed Number or by changing source precedence.
  const minusOne = () => valueLiteral(expression({op:'integer',value:'-1'}));
  const negate = (ir) => selected('multiply',[minusOne(),ir]);
  const subtract = (lhs,rhs) => selected('add',[lhs,negate(rhs)]);
  const divide = (lhs,rhs) => selected('multiply',[
    lhs,selected('power',[rhs,minusOne()])
  ]);
  const visit = (node, scope = lexicalScope) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) reject('invalid expression node');
    switch (node.type) {
      case 'Literal': {
        // Peggy parseFloat is safe here only for exact, safe integer literals.
        // Exact noninteger decimal notation gets a separate numerical contract.
        if (!Number.isSafeInteger(node.value) || node.value < 0 || !INT.test(String(node.value)))
          reject('only nonnegative safe integer literals supported');
        return valueLiteral(expression({op:'integer',value:String(node.value)}));
      }
      case 'Variable': {
        if (typeof node.name !== 'string' || !SOURCE_NAME.test(node.name))
          reject('invalid variable name');
        // Lexical and operation-local identities shadow document writers.
        // A free-symbol result from this scope is NOT a document lookup: the
        // caller still owns nearest-predecessor/free-symbol resolution.
        if (scope !== null) {
          const identity = scope.resolve(node.name);
          if (identity.kind !== 'free-symbol') return semanticReference(identity);
        }
        if (typeof resolveVariable !== 'function') reject(`variable ${node.name} requires document-owned binding`);
        const bound = resolveVariable(node.name);
        if (!isSemanticIRNode(bound) ||
            (bound.kind !== 'provider-reference' && bound.kind !== 'semantic-reference'))
          reject(`variable ${node.name} requires provider-reference or semantic-reference`);
        return bound;
      }
      case 'UnaryExpression': {
        if (node.op !== '-') reject(`unsupported unary operator ${String(node.op)}`);
        return negate(visit(node.argument, scope));
      }
      case 'BinaryExpression': {
        if (node.op === '-') return subtract(visit(node.left,scope),visit(node.right,scope));
        if (node.op === '/') return divide(visit(node.left,scope),visit(node.right,scope));
        const name = OP[node.op];
        if (!name) reject(`unsupported binary operator ${String(node.op)}`);
        return selected(name, [visit(node.left,scope),visit(node.right,scope)]);
      }
      case 'PowerExpression': return selected('power',[visit(node.base,scope),visit(node.exponent,scope)]);
      case 'FunctionCall': {
        if (typeof node.name !== 'string' || !Array.isArray(node.args)) reject('invalid function call');
        // Consume P0008 argument roles through the existing P0019 resolver.
        // Only one symbolic target is supported in this bounded slice. Scoped
        // signatures remain fail-closed until scopeOver is implemented.
        const spec = specs.get(node.name);
        if (!isOperationSpec(spec) || spec.operationId !== node.name)
          reject(`unselected operation ${node.name}`);
        const plan = planOperationArguments(spec, node.args.length);
        if (plan.status !== 'selected') reject(`operation ${node.name} requires unsupported arity or argument roles`);
        if (plan.arguments.some(a => a.role === 'scoped'))
          reject(`operation ${node.name} requires unsupported scoped role`);
        const targets = plan.arguments.filter(a => a.role === 'symbolic');
        if (targets.length > 0) {
          if (targets.length !== 1) reject('multiple symbolic targets not supported in this slice');
          if (scope === null || typeof makeLocalId !== 'function')
            reject('symbolic role requires document-owned lexical scope and identity supplier');
          // The P0019 helper allocates a symbolic target without visiting its
          // Variable node; enforce the same canonical source-name policy here.
          const index = plan.arguments.findIndex(a => a.role === 'symbolic');
          const target = node.args[index];
          if (target?.type === 'Variable' &&
              (typeof target.name !== 'string' || !SOURCE_NAME.test(target.name)))
            reject('invalid symbolic variable name');
          return resolveSelectedOperationCall(node, spec,
            (arg, meta) => visit(arg, meta.lexicalScope ?? scope), makeLocalId, scope);
        }
        return selected(node.name,node.args.map(arg => visit(arg,scope)));
      }
      default: reject(`unsupported node type ${String(node.type)}`);
    }
  };
  if (Array.isArray(ast)) {
    if (ast.length !== 1) reject('exactly one parsed expression required');
    ast=ast[0];
  }
  return visit(ast);
}
