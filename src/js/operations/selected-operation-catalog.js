/** P0008 selected-capability catalog. Not yet the application runtime registry.
 * The evaluator IDs below are the CURRENT P0012 test capabilities, not stable
 * public names. Keep operationId separate from evaluatorId.
 */
import { operationSpec, isOperationSpec } from './operation-spec.js';
const V = (name) => ({name, role: 'value'});
const S = (name) => ({name, role: 'symbolic'});

const definitions = [
  operationSpec({operationId: 'list', evaluatorId: 'probe.container.list',
    arguments: [{name:'item', role:'value', variadic:true}]}),
  operationSpec({operationId: 'mean', evaluatorId: 'probe.statistics.mean',
    arguments: [V('data')]}),
  ...['variance','standard_deviation','sample_variance','sample_standard_deviation'].map(operationId=>operationSpec({
    operationId, evaluatorId:`probe.statistics.${operationId}`, arguments:[V('data')]})),
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

/** Structural equivalence to the selected P0008 catalog policy, including
 * argument roles and evaluator identity. No implicit operation selection.
 * An immutable rehydrated OperationSpec may match, but a changed contract may not.
 */
export function matchesSelectedOperationSpec(spec) {
  if (!isOperationSpec(spec)) return false;
  const expected=byName.get(spec.operationId);
  if (!expected || spec.evaluatorId!==expected.evaluatorId ||
      spec.purity!==expected.purity ||
      spec.diagnosticAdapterId!==expected.diagnosticAdapterId ||
      spec.signatures.length!==expected.signatures.length) return false;
  for(let i=0;i<spec.signatures.length;i++) {
    const actual=spec.signatures[i].arguments;
    const required=expected.signatures[i].arguments;
    if(actual.length!==required.length) return false;
    for(let j=0;j<actual.length;j++) {
      const a=actual[j],r=required[j];
      if(a.name!==r.name || a.role!==r.role ||
          (a.variadic===true)!==(r.variadic===true)) return false;
      const as=a.scopeOver??[],rs=r.scopeOver??[];
      if(as.length!==rs.length || as.some((name,k)=>name!==rs[k])) return false;
    }
  }
  return true;
}
