/** P0021 Slice 34: selected derivative of an already materialized FunctionValue.
 * The function's lexical binder is the symbolic target. Existing P0021 Slice 23
 * compiles the P0010 request; no source names, Python scope, or new registry.
 */
import {isValue,expression} from '../values/value.js';
import {isSemanticIdentity} from './identity.js';
import {applySelectedFunctionValue} from './apply-selected-function-value.js';
import {compileSelectedSymbolicDiff} from './compile-selected-symbolic-diff.js';
import {call,operationReference,semanticReference,valueLiteral} from './semantic-ir.js';

const fail = message => { throw new TypeError(`P0021 function derivative: ${message}`); };

export function compileSelectedFunctionDerivative({fn,envelope,spec} = {}) {
  if (!isValue(fn) || fn.kind !== 'function') fail('FunctionValue required');
  if (fn.data.parameters.length !== 1) fail('one-parameter derivative only');
  const identity=fn.data.parameters[0]?.identity;
  if (!isSemanticIdentity(identity) || identity.kind !== 'binder') fail('lexical binder required');
  if (!envelope || !Array.isArray(envelope.providers) || envelope.providers.length)
    fail('function captures must already be materialized; no source providers');
  // Reuse the identity-aware application to substitute captures, but *not* the parameter.
  const symbolicArgument=expression({op:'symbolRef',identity});
  const body=applySelectedFunctionValue(fn,[symbolicArgument]);
  const ir=call(operationReference('diff'),[valueLiteral(body),semanticReference(identity)]);
  return compileSelectedSymbolicDiff(envelope,ir,spec);
}
