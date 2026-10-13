/** P0021 Slice 36: wrap an already evaluated derivative ExpressionValue as a
 * lexical FunctionValue. The document owns the source function and result
 * attestation. No Python evaluation, name resolution, or new binder allocation.
 */
import {identityKey, isSemanticIdentity} from './identity.js';
import {functionValue, isValue} from '../values/value.js';

const fail = message => { throw new TypeError(`P0021 derivative FunctionValue: ${message}`); };

export function materializeSelectedDerivativeFunction({fn, derivative, targetIdentity} = {}) {
  if (!isValue(fn) || fn.kind !== 'function') fail('source FunctionValue required');
  if (fn.data.parameters.length !== 1) fail('one-parameter function required');
  const binder = fn.data.parameters[0].identity;
  if (!isSemanticIdentity(binder) || binder.kind !== 'binder') fail('lexical binder required');
  if (!isSemanticIdentity(targetIdentity) || identityKey(targetIdentity) !== identityKey(binder))
    fail('different differentiation target identity');
  if (!isValue(derivative) || derivative.kind !== 'expression') fail('derivative ExpressionValue required');
  // Slice 34 materializes all external captures before differentiation.
  // A result containing any other identity therefore cannot be a closed derivative.
  const visit = node => {
    if (!node || typeof node !== 'object') fail('invalid derivative node');
    switch (node.op) {
      case 'symbolRef':
        if (!isSemanticIdentity(node.identity) || identityKey(node.identity) !== identityKey(binder))
          fail('unresolved or foreign derivative symbol identity');
        return;
      case 'integer': case 'rational': case 'approx': case 'constant': return;
      case 'add': case 'mul':
        if (!Array.isArray(node.args)) fail('invalid derivative arguments');
        node.args.forEach(visit);
        return;
      case 'pow': visit(node.base); visit(node.exponent); return;
      default: fail(`unsupported derivative expression ${node.op}`);
    }
  };
  visit(derivative.data.expr);
  return functionValue([{identity:binder}],derivative,[]);
}
