/** P0021 Slice 23 / Slice 93h: bounded selected symbolic diff -> P0010 request.
 * Reuses the shared P0005 Value materializer for explicitly selected symbolic
 * operands. Does not evaluate, resolve document names, or generate Python.
 */
import { isOperationSpec } from '../operations/operation-spec.js';
import { planOperationArguments } from './operation-argument-plan.js';
import { isSemanticIRNode } from './semantic-ir.js';
import { materializeSelectedSymbolicArguments } from './materialize-selected-symbolic-arguments.js';

const fail = message => { throw new TypeError(`P0021 symbolic diff: ${message}`); };
const freeze = obj => { if (obj && typeof obj === 'object') { Object.values(obj).forEach(freeze); Object.freeze(obj); } return obj; };
const clone = obj => JSON.parse(JSON.stringify(obj));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function compileSelectedSymbolicDiff(envelope, ir, spec) {
  if (!isSemanticIRNode(ir) || !isOperationSpec(spec))
    fail('immutable IR and selected OperationSpec required');
  const root = ir.kind === 'define' ? ir.body : ir;
  if (root?.kind !== 'call' || root.callee?.kind !== 'operation-reference' ||
      root.callee.operationId !== spec.operationId) fail('selected operation mismatch');
  const plan = planOperationArguments(spec, root.args.length);
  if (plan.status !== 'selected' || !equal(plan.arguments.map(a => a.role), ['value', 'symbolic']) ||
      spec.evaluatorId !== 'probe.symbolic.diff') fail('selected first-order differentiation required');

  const {inputs, providerIds} = materializeSelectedSymbolicArguments(envelope, ir, spec);
  return freeze({
    blockId: envelope.blockId, revision: envelope.revision,
    taskScopeId: envelope.taskScopeId, source: envelope.source,
    providerIds: clone(providerIds),
    evaluationRequest: {
      evaluationRequestVersion: 1, evaluatorId: spec.evaluatorId,
      inputs: clone(inputs), instruction: {}, options: {},
    },
    operationSpec: clone(spec),
  });
}
