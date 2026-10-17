/** P0021 Slice 93h — pure, selected symbolic IR -> P0005 Value operands.
 * The caller owns source analysis, semantic identity creation, selection and
 * provider attestation. This function neither evaluates nor dispatches.
 * Only the bounded P0005 scalar expression vocabulary is materialized.
 */
import { isOperationSpec } from '../operations/operation-spec.js';
import { planOperationArguments } from './operation-argument-plan.js';
import { isSemanticIRNode } from './semantic-ir.js';
import { expression, isValue } from '../values/value.js';

const fail = message => { throw new TypeError(`P0021 symbolic operands: ${message}`); };
const clone = value => JSON.parse(JSON.stringify(value));
const unary = new Set(['sin', 'cos', 'exp', 'log']);

export function materializeSelectedSymbolicArguments(envelope, ir, spec) {
  if (!envelope || envelope.protocol !== 'newcas.semantic-evaluation.v1' ||
      !['revision', 'blockId', 'taskScopeId', 'source'].every(key =>
        typeof envelope[key] === 'string' && envelope[key]) ||
      !Array.isArray(envelope.providers)) fail('invalid gateway envelope');
  if (!isSemanticIRNode(ir) || !isOperationSpec(spec))
    fail('immutable Semantic IR and selected OperationSpec required');
  const root = ir.kind === 'define' ? ir.body : ir;
  if (ir.kind === 'define' && ir.writerId !== envelope.blockId)
    fail('writer identity mismatch');
  if (root?.kind !== 'call' || root.callee?.kind !== 'operation-reference' ||
      root.callee.operationId !== spec.operationId) fail('selected operation mismatch');
  const plan = planOperationArguments(spec, root.args.length);
  if (plan.status !== 'selected' || !plan.arguments.some(a => a.role === 'symbolic') ||
      plan.arguments.some(a => a.role !== 'symbolic' && a.role !== 'value'))
    fail('selected symbolic/value argument roles required');

  const providers = new Map(), names = new Set(), used = new Set();
  for (const p of envelope.providers) {
    if (!p || typeof p.name !== 'string' || !p.name || names.has(p.name) ||
        typeof p.providerId !== 'string' || !p.providerId || providers.has(p.providerId) ||
        !isValue(p.value)) fail('invalid provider attestation');
    providers.set(p.providerId, p);
    names.add(p.name);
  }
  const materialize = node => {
    if (!isSemanticIRNode(node)) fail('invalid symbolic IR node');
    if (node.kind === 'value') {
      if (!isValue(node.value) || node.value.kind !== 'expression')
        fail('expression Value required');
      return clone(node.value.data.expr);
    }
    if (node.kind === 'semantic-reference') return {op: 'symbolRef', identity: clone(node.identity)};
    if (node.kind === 'provider-reference') {
      const provider = providers.get(node.providerId);
      if (!provider || provider.value.kind !== 'expression') fail('missing expression provider');
      used.add(node.providerId);
      return clone(provider.value.data.expr);
    }
    if (node.kind !== 'call' || node.callee?.kind !== 'operation-reference')
      fail('unsupported symbolic expression IR');
    const args = node.args.map(materialize);
    switch (node.callee.operationId) {
      case 'add': if (args.length === 2) return {op: 'add', args}; break;
      case 'multiply': if (args.length === 2) return {op: 'mul', args}; break;
      case 'power': if (args.length === 2) return {op: 'pow', base: args[0], exponent: args[1]}; break;
      default:
        if (unary.has(node.callee.operationId) && args.length === 1)
          return {op: 'call', name: node.callee.operationId, args};
    }
    fail('unsupported symbolic expression operation or arity');
  };
  const inputs = root.args.map((argument, index) => {
    if (plan.arguments[index].role === 'symbolic' && argument.kind !== 'semantic-reference')
      fail('symbolic target must be explicit identity');
    return expression(materialize(argument));
  });
  if (used.size !== providers.size) fail('unused provider attestation');
  return Object.freeze({
    inputs: Object.freeze(inputs),
    providerIds: Object.freeze(envelope.providers.map(p => Object.freeze({
      name: p.name, providerId: p.providerId,
    }))),
  });
}
