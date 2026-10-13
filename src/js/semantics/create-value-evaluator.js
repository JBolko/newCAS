/** P0021 Slice 7: explicit, portable evaluator gateway.
 * Does NOT invoke the old CASEngine.calculate() (Python task scope).
 * The host supplies a backend-neutral invoke(request), which a future
 * Pyodide/Worker adapter may implement. No backend-owned document state.
 */
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
function portable(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const valid = (!Array.isArray(value) || Object.keys(value).length === value.length) &&
    Object.entries(value).every(([key,child]) => key !== '__proto__' && portable(child, ancestors));
  ancestors.delete(value);
  return valid;
}
function frozenCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,frozenCopy(v)])));
  return value;
}
function validSuccess(outcome, id) {
  return outcome && outcome.blockId === id && outcome.status === 'success' &&
    own(outcome,'value') && portable(outcome.value);
}
/**
 * getProviderOutcome(providerId): returns a validated, successful outcome from
 * the document's CURRENT revision, or null. Caller owns revision filtering.
 * invoke receives an immutable portable request and returns an outcome.
 * This gateway does not claim to have implemented OperationSpec or P0011.
 */
export function createValueEvaluator({invoke, getProviderOutcome, revision} = {}) {
  if (typeof invoke !== 'function' || typeof getProviderOutcome !== 'function' ||
      typeof revision !== 'string' || !revision) throw new TypeError('invoke, provider reader and revision required');
  return async function evaluateTask(task) {
    if (!task || typeof task.blockId !== 'string' || !task.blockId ||
        typeof task.taskScopeId !== 'string' || !task.taskScopeId ||
        typeof task.source !== 'string' || !Array.isArray(task.providers) || !Array.isArray(task.upstream)) {
      throw new TypeError('invalid evaluation task');
    }
    const upstream = new Set(task.upstream);
    if (upstream.size !== task.upstream.length || [...upstream].some(id => typeof id !== 'string' || !id)) throw new TypeError('invalid upstream identifiers');
    const seenNames = new Set();
    const providers = [];
    for (const binding of task.providers) {
      if (!binding || typeof binding.name !== 'string' || !binding.name || seenNames.has(binding.name) ||
          !upstream.has(binding.providerId)) throw new TypeError('provider binding not in dependency graph');
      seenNames.add(binding.name);
      const outcome = getProviderOutcome(binding.providerId);
      if (!validSuccess(outcome,binding.providerId)) {
        return Object.freeze({blockId:task.blockId,status:'failure',code:'PROVIDER_UNAVAILABLE',
          message:`Provider ${binding.providerId} has no valid current-revision Value`});
      }
      providers.push({name:binding.name,providerId:binding.providerId,value:outcome.value});
    }
    const request = frozenCopy({protocol:'newcas.semantic-evaluation.v1',revision,
      blockId:task.blockId,taskScopeId:task.taskScopeId,source:task.source,providers});
    // This boundary must be valid across a future Worker postMessage channel.
    if (!portable(request)) throw new TypeError('nonportable evaluator request');
    return await invoke(request);
  };
}
