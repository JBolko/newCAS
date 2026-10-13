/** P0019 first boundary: interpret P0008 signatures, do NOT resolve symbols. */
import { isOperationSpec } from '../operations/operation-spec.js';

function matches(signature, arity) {
  const args = signature.arguments;
  const variadic = args.at(-1)?.variadic === true;
  return variadic ? arity >= args.length - 1 : arity === args.length;
}

/** Returns immutable positional policy for a call, or a clear arity failure.
 * This layer never reads document values, makes identities or dispatches Python.
 */
export function planOperationArguments(spec, arity) {
  if (!isOperationSpec(spec)) throw new TypeError('expected P0008 OperationSpec');
  if (!Number.isSafeInteger(arity) || arity < 0) throw new TypeError('invalid call arity');
  const candidates = spec.signatures.filter(s => matches(s, arity));
  if (candidates.length === 0) return Object.freeze({status:'wrong-arity',
    operationId:spec.operationId,
    expected:Object.freeze(spec.signatures.map(s => s.arguments.length)), actual:arity});
  if (candidates.length !== 1) throw new TypeError('ambiguous OperationSpec signatures');
  const signature = candidates[0];
  const planned = Array.from({length:arity}, (_,i) => {
    const definition = signature.arguments[Math.min(i,signature.arguments.length-1)];
    return Object.freeze({index:i, name:definition.name, role:definition.role,
      ...(definition.role==='scoped' ? {scopeOver:Object.freeze([...definition.scopeOver])}: {})});
  });
  return Object.freeze({status:'selected', operationId:spec.operationId,
    evaluatorId:spec.evaluatorId, signature,
    arguments:Object.freeze(planned)});
}
