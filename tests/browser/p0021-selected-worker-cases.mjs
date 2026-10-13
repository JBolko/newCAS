/** Real compiler fixture shared by browser smoke and Node contract tests. */
import { compileSelectedValueCall } from '../../src/js/semantics/compile-selected-value-call.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import { valueLiteral, providerReference, operationReference, call, define } from '../../src/js/semantics/semantic-ir.js';
const integer = n => Object.freeze({valueVersion:1,kind:'expression',data:Object.freeze({expr:Object.freeze({op:'integer',value:String(n)})})});
const spec = operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
export function makeSelectedCase({revision='smoke-1',kind='literal'}={}) {
  const bound = kind === 'provider';
  if (kind !== 'literal' && !bound) throw new TypeError('unknown smoke case');
  const providers = bound ? [{name:'a',providerId:'writer-a',value:integer(4)}] : [];
  const source = bound ? 'b := a+3' : 'b := 2+3';
  const envelope = {protocol:'newcas.semantic-evaluation.v1',revision,blockId:'b',taskScopeId:'smoke-task',source,providers};
  const args = bound ? [providerReference('writer-a'),valueLiteral(integer(3))] : [valueLiteral(integer(2)),valueLiteral(integer(3))];
  const ir = define('b',call(operationReference('add'),args));
  return {envelope,selection:compileSelectedValueCall(envelope,ir,spec)};
}
export function isExactInteger(outcome, n) {
  return outcome?.status === 'success' && outcome.blockId === 'b' && outcome.value?.valueVersion === 1 &&
    outcome.value?.kind === 'expression' && outcome.value?.data?.expr?.op === 'integer' &&
    outcome.value?.data?.expr?.value === String(n);
}
