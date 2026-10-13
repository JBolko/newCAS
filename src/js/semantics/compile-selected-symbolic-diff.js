/** P0021 Slice 23: bounded symbolic diff -> selected P0010 request.
 * Materializes source IR expressions without evaluating symbol-bearing subcalls.
 * Selection, identities and providers are exclusively supplied by JS caller.
 */
import { isOperationSpec } from '../operations/operation-spec.js';
import { planOperationArguments } from './operation-argument-plan.js';
import { isSemanticIRNode } from './semantic-ir.js';
import { expression, isValue } from '../values/value.js';

const fail = message => { throw new TypeError(`P0021 symbolic diff: ${message}`); };
const freeze = obj => { if (obj && typeof obj === 'object') { Object.values(obj).forEach(freeze); Object.freeze(obj); } return obj; };
const clone = obj => JSON.parse(JSON.stringify(obj));
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);

export function compileSelectedSymbolicDiff(envelope, ir, spec) {
  if (!envelope || envelope.protocol !== 'newcas.semantic-evaluation.v1' ||
      !['revision','blockId','taskScopeId','source'].every(k=>typeof envelope[k]==='string' && envelope[k]) ||
      !Array.isArray(envelope.providers)) fail('invalid gateway envelope');
  if (!isSemanticIRNode(ir) || !isOperationSpec(spec)) fail('immutable IR and selected OperationSpec required');
  const root = ir.kind === 'define' ? ir.body : ir;
  if (ir.kind === 'define' && ir.writerId !== envelope.blockId) fail('writer identity mismatch');
  if (root?.kind !== 'call' || root.callee?.kind !== 'operation-reference' || root.callee.operationId !== spec.operationId)
    fail('selected operation mismatch');
  const plan = planOperationArguments(spec,root.args.length);
  if (plan.status !== 'selected' || !equal(plan.arguments.map(a=>a.role),['value','symbolic']) ||
      spec.evaluatorId !== 'probe.symbolic.diff') fail('selected first-order differentiation required');
  const providers = new Map();
  const names = new Set();
  for (const entry of envelope.providers) {
    if (!entry || typeof entry.name !== 'string' || !entry.name || typeof entry.providerId !== 'string' ||
        !entry.providerId || !isValue(entry.value) || providers.has(entry.providerId) || names.has(entry.name))
      fail('invalid provider attestation');
    providers.set(entry.providerId,entry);
    names.add(entry.name);
  }
  const used = new Set();
  const materialize = node => {
    if (node.kind === 'value') {
      if (!isValue(node.value) || node.value.kind !== 'expression') fail('expression Value required');
      return clone(node.value.data.expr);
    }
    if (node.kind === 'semantic-reference') return {op:'symbolRef',identity:clone(node.identity)};
    if (node.kind === 'provider-reference') {
      const provider = providers.get(node.providerId);
      if (!provider || provider.value.kind !== 'expression') fail('missing expression provider');
      used.add(node.providerId);
      return clone(provider.value.data.expr);
    }
    if (node.kind !== 'call' || node.callee?.kind !== 'operation-reference') fail('unsupported symbolic expression IR');
    const args = node.args.map(materialize);
    switch (node.callee.operationId) {
      case 'add': if (args.length === 2) return {op:'add',args}; break;
      case 'multiply': if (args.length === 2) return {op:'mul',args}; break;
      case 'power': if (args.length === 2) return {op:'pow',base:args[0],exponent:args[1]}; break;
      case 'sin': case 'cos': case 'exp': case 'log':
        if (args.length === 1) return {op:'call',name:node.callee.operationId,args};
        break;
    }
    fail('unsupported symbolic expression operation or arity');
  };
  if (root.args[1]?.kind !== 'semantic-reference') fail('symbolic target must be explicit identity');
  const inputs = [expression(materialize(root.args[0])),expression(materialize(root.args[1]))];
  if (used.size !== providers.size) fail('unused provider attestation');
  return freeze({
    blockId:envelope.blockId, revision:envelope.revision,taskScopeId:envelope.taskScopeId,source:envelope.source,
    providerIds:envelope.providers.map(p=>({name:p.name,providerId:p.providerId})),
    evaluationRequest:{evaluationRequestVersion:1,evaluatorId:spec.evaluatorId,inputs,instruction:{},options:{}},
    operationSpec:clone(spec),
  });
}
