/** P0021 Slice 2: pure conservative recomputation planning.
 * Inputs: two projections of semantic snapshots for the SAME task plus explicit
 * source-changed block IDs. No parsing, symbol resolution, evaluation or mutation.
 *
 * Recompute a retained block when its own source changed, its provider bindings
 * changed, or it is transitively downstream of either cause in the old OR new
 * graph. Deleted blocks are returned separately (never evaluated).
 */
export function planSemanticRecomputation(oldAnalysis, newAnalysis, changedSources = []) {
  function validate(a) {
    if (!a || !a.graph || !(a.graph.nodes instanceof Set) ||
        !(a.bindings instanceof Map) ||
        typeof a.graph.getAllDownstream !== 'function') {
      throw new TypeError('expected projected semantic dependency analysis');
    }
    for (const id of a.graph.nodes) {
      if (typeof id !== 'string' || !id || !(a.bindings.get(id) instanceof Map)) {
        throw new TypeError('graph and binding identities must match');
      }
    }
    if (a.bindings.size !== a.graph.nodes.size ||
        [...a.bindings.keys()].some(id => !a.graph.nodes.has(id))) {
      throw new TypeError('graph and binding identities must match');
    }
  }
  validate(oldAnalysis);
  validate(newAnalysis);
  if (!Array.isArray(changedSources) || changedSources.some(id => typeof id !== 'string' || !id)) {
    throw new TypeError('changedSources must be an array of block identities');
  }
  const oldNodes = oldAnalysis.graph.nodes;
  const newNodes = newAnalysis.graph.nodes;
  const removed = new Set([...oldNodes].filter(id => !newNodes.has(id)));
  const inserted = new Set([...newNodes].filter(id => !oldNodes.has(id)));
  const bindingChanges = new Set();
  const equalBindings = (a,b) => a.size===b.size && [...a].every(([name,provider])=>b.has(name)&&b.get(name)===provider);
  for (const id of newNodes) {
    if (oldNodes.has(id) && !equalBindings(oldAnalysis.bindings.get(id),newAnalysis.bindings.get(id))) {
      bindingChanges.add(id);
    }
  }
  const requestedChanges = new Set(changedSources);
  if ([...requestedChanges].some(id => !oldNodes.has(id) && !newNodes.has(id))) {
    throw new TypeError('changed source ID absent in both analyses');
  }
  const seeds = new Set([...requestedChanges,...removed,...inserted,...bindingChanges]);
  const impacted = new Set(seeds);
  for (const id of seeds) {
    if (oldNodes.has(id)) for (const dep of oldAnalysis.graph.getAllDownstream(id)) impacted.add(dep);
    if (newNodes.has(id)) for (const dep of newAnalysis.graph.getAllDownstream(id)) impacted.add(dep);
  }
  const recompute = new Set([...impacted].filter(id => newNodes.has(id)));
  return { recompute, removed, inserted, bindingChanges };
}
