/** Source occurrence roles for one *already selected* P0008 operation signature.
 *
 * P0019 v1: symbolic target(s) govern source value operands strictly before
 * the first symbolic target. Operands after that target (e.g. bounds) remain
 * in their enclosing lexical scope. No document lookup or Value evaluation.
 * A future scoped-role implementation must be specified separately.
 */
import {planOperationArguments} from './operation-argument-plan.js';

export class UnsupportedSourceOperationRole extends TypeError {}

export function planSourceOccurrenceRoles(ast, spec) {
  if (!ast || ast.type !== 'FunctionCall' || !Array.isArray(ast.args) ||
      ast.name !== spec?.operationId) throw new TypeError('selected source operation required');
  const plan = planOperationArguments(spec, ast.args.length);
  if (plan.status !== 'selected') return plan;
  if (plan.arguments.some(argument => argument.role === 'scoped')) {
    throw new UnsupportedSourceOperationRole('scoped source argument roles not implemented');
  }
  const targets = [];
  for (let i = 0; i < plan.arguments.length; i++) {
    if (plan.arguments[i].role !== 'symbolic') continue;
    const target = ast.args[i];
    if (!target || target.type !== 'Variable' || typeof target.name !== 'string' || !target.name) {
      throw new UnsupportedSourceOperationRole(`symbolic argument ${plan.arguments[i].name} requires a variable reference`);
    }
    targets.push(Object.freeze({index:i, name:target.name}));
  }
  const first = targets[0]?.index ?? -1;
  const occurrences = plan.arguments.map((argument, index) => Object.freeze({
    index,
    role: argument.role,
    governedBy: Object.freeze(first >= 0 && index < first ? targets.map(t => t.name) : []),
  }));
  return Object.freeze({status:'selected', plan,
    targets:Object.freeze(targets), occurrences:Object.freeze(occurrences)});
}
