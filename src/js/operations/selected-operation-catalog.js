/** P0008 selected-capability catalog. Not yet the application runtime registry.
 * The evaluator IDs below are the CURRENT P0012 test capabilities, not stable
 * public names. Keep operationId separate from evaluatorId.
 */
import { operationSpec, isOperationSpec } from './operation-spec.js';
const V = (name) => ({name, role: 'value'});
const S = (name) => ({name, role: 'symbolic'});

const definitions = [
  operationSpec({operationId: 'integrate', evaluatorId: 'probe.symbolic.integrate', signatures: [
    {arguments: [V('integrand'), S('variable')]},
    {arguments: [V('integrand'), S('variable'), V('lower'), V('upper')]},
  ]}),
  operationSpec({operationId: 'tangentline', evaluatorId: 'probe.symbolic.tangentline',
    arguments: [V('expression'), S('variable'), V('at')]}),
  operationSpec({operationId: 'arclength', evaluatorId: 'probe.symbolic.arclength',
    arguments: [V('expression'), S('variable'), V('start'), V('end')]}),
  operationSpec({operationId: 'surfacearea', evaluatorId: 'probe.symbolic.surfacearea',
    arguments: [V('expression'), S('variable'), V('start'), V('end')]}),
];

const byName = new Map();
for (const spec of definitions) {
  if (!isOperationSpec(spec) || byName.has(spec.operationId)) {
    throw new Error(`Invalid or duplicate catalog operation: ${spec.operationId}`);
  }
  byName.set(spec.operationId, spec);
}

export const selectedOperationSpecs = Object.freeze([...definitions]);
export function findSelectedOperationSpec(operationId) {
  return byName.get(operationId) ?? null;
}
