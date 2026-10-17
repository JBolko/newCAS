/** P0019 slice 2: apply an already-selected OperationSpec role plan to
 * a parser FunctionCall. Caller owns document lookup and unique identities.
 * No Python dispatch, source rewriting, or DocumentRuntime state.
 */
import { operationLocalIdentity, LexicalIdentityScope } from './identity.js';
import { operationReference, semanticReference, call, isSemanticIRNode } from './semantic-ir.js';
import { planSourceOccurrenceRoles } from './plan-source-occurrence-roles.js';

export function resolveSelectedOperationCall(ast, spec, resolveValue, makeLocalId, lexicalScope = null) {
  if (!ast || ast.type !== 'FunctionCall' || !Array.isArray(ast.args)) {
    throw new TypeError('expected FunctionCall AST');
  }
  if (typeof resolveValue !== 'function' || typeof makeLocalId !== 'function') {
    throw new TypeError('expected caller-owned value resolver and identity supplier');
  }
  if (ast.name !== spec?.operationId) {
    throw new TypeError('selected operation name does not match source call');
  }
  const occurrencePlan = planSourceOccurrenceRoles(ast, spec);
  if (occurrencePlan.status !== 'selected') return occurrencePlan;
  const plan = occurrencePlan.plan;

  if (lexicalScope !== null && !(lexicalScope instanceof LexicalIdentityScope)) {
    throw new TypeError('expected a LexicalIdentityScope or null');
  }
  // Create symbolic identities before visiting source operands. The shared
  // occurrence plan also drives P0020 document dependency projection.
  const targets = occurrencePlan.targets.map(({index,name}) => ({
    index, identity:operationLocalIdentity(
      makeLocalId({operationId: spec.operationId, index, name}), name),
  }));
  const scoped = lexicalScope === null
    ? null
    : lexicalScope.push(targets.map(target => target.identity));
  const args = ast.args.map((node,index) => {
    const policy = plan.arguments[index];
    if (policy.role === 'symbolic') {
      const target = targets.find(target => target.index === index);
      return semanticReference(target.identity);
    }
    // Ordinary Values may be a source AST or a *previously materialized*
    // Value. That decision belongs to the caller's resolver. In particular,
    // do NOT recursively re-resolve an already materialized Value.
    const metadata = {index, name:policy.name, role:policy.role};
    // In this bounded source-scope slice, source operands preceding the
    // symbolic target use its local identity. Later ordinary operands,
    // including integration bounds, resolve under the caller scope.
    const governing = occurrencePlan.occurrences[index].governedBy.length ? scoped : lexicalScope;
    if (governing !== null) metadata.lexicalScope = governing;
    const resolved = resolveValue(node, Object.freeze(metadata));
    if (!isSemanticIRNode(resolved)) throw new TypeError('value resolver must return Semantic IR');
    return resolved;
  });
  return call(operationReference(spec.operationId), args);
}
