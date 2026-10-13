/** P0021 Slice 9: compile an already-selected Semantic IR value-only call.
 * Does not parse source, resolve symbols, select an operation or invoke Python.
 * Symbolic/scoped roles and nested calls are deliberately unsupported.
 */
import { isOperationSpec } from '../operations/operation-spec.js';
import { planOperationArguments } from './operation-argument-plan.js';
import { isSemanticIRNode } from './semantic-ir.js';

function fail(reason) { throw new TypeError(`P0021 selected call: ${reason}`); }
const copy = obj => JSON.parse(JSON.stringify(obj));
const freeze = obj => {
  if (obj && typeof obj === 'object') { Object.values(obj).forEach(freeze); Object.freeze(obj); }
  return obj;
};
function portable(value) {
  try { const data = JSON.stringify(value); return data !== undefined && !data.includes('null_not_a_value') && JSON.stringify(JSON.parse(data)) === data; }
  catch { return false; }
}

export function compileSelectedValueCall(envelope, ir, spec) {
  if (!envelope || envelope.protocol !== 'newcas.semantic-evaluation.v1' ||
      !['revision','blockId','taskScopeId','source'].every(k => typeof envelope[k] === 'string' && envelope[k]) ||
      !Array.isArray(envelope.providers) || !portable(envelope)) fail('invalid gateway envelope');
  if (!isOperationSpec(spec)) fail('P0008 OperationSpec required');
  if (!isSemanticIRNode(ir)) fail('immutable Semantic IR required');
  const expression = ir.kind === 'define' ? ir.body : ir;
  if (ir.kind === 'define' && ir.writerId !== envelope.blockId) fail('writer/block identity mismatch');
  if (expression?.kind !== 'call' || expression.callee?.kind !== 'operation-reference') fail('selected operation call required');
  if (expression.callee.operationId !== spec.operationId) fail('operation identity mismatch');
  const policy = planOperationArguments(spec, expression.args.length);
  if (policy.status !== 'selected') fail('wrong arity');
  if (policy.arguments.some(arg => arg.role !== 'value')) fail('symbolic and scoped roles are not yet supported');
  const providers = envelope.providers;
  if (providers.some(p => !p || typeof p.name !== 'string' || !p.name ||
        typeof p.providerId !== 'string' || !p.providerId || !Object.hasOwn(p,'value')) ||
      new Set(providers.map(p => p.name)).size !== providers.length ||
      new Set(providers.map(p => p.providerId)).size !== providers.length) fail('invalid provider bindings');
  const byId = new Map(providers.map(p=>[p.providerId,p]));
  const used = new Set();
  const inputs = expression.args.map(arg => {
    if (arg.kind === 'value') return copy(arg.value);
    if (arg.kind === 'provider-reference') {
      const entry = byId.get(arg.providerId);
      if (!entry) fail('provider identity not in gateway envelope');
      used.add(entry.providerId);
      return copy(entry.value);
    }
    fail('unsupported argument IR');
  });
  if (used.size !== providers.length) fail('unused or unexpected provider bindings');
  if (!portable(inputs)) fail('nonportable Value');
  const output = {
    blockId:envelope.blockId, revision:envelope.revision, taskScopeId:envelope.taskScopeId,
    source:envelope.source,
    providerIds:providers.map(p=>({name:p.name,providerId:p.providerId})),
    evaluationRequest:{evaluationRequestVersion:1,evaluatorId:spec.evaluatorId,inputs,instruction:{},options:{}},
    operationSpec:copy(spec),
  };
  return freeze(output);
}
