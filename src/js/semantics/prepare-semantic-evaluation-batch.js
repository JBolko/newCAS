/** P0021 Slice 4 — pure boundary between document planning and evaluation.
 * Produces ordered evaluation requests without parsing source, resolving names,
 * converting Values, invoking Python, or changing DocumentRuntime.
 * The dispatcher must supply outcomes in order; this is NOT a parallel batch.
 */
export function prepareSemanticEvaluationBatch(snapshot, analysis, schedule, sources, cachedIds = []) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || typeof snapshot.taskScopeId !== 'string' || !snapshot.taskScopeId ||
      !analysis || !(analysis.bindings instanceof Map) || !(analysis.graph?.nodes instanceof Set) ||
      typeof analysis.graph.getUpstream !== 'function' ||
      !schedule || !Array.isArray(schedule.order) || !Array.isArray(schedule.cycles) || !Array.isArray(schedule.blocked) ||
      !(sources instanceof Map) || !Array.isArray(cachedIds)) {
    throw new TypeError('invalid evaluation batch inputs');
  }
  const ids = snapshot.blocks.map(b => b?.blockId);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length ||
      ids.length !== analysis.graph.nodes.size || ids.some(id => !analysis.graph.nodes.has(id)) ||
      ids.some(id => !(analysis.bindings.get(id) instanceof Map))) {
    throw new TypeError('snapshot and projected graph must describe identical blocks');
  }
  const valid = new Set(ids);
  const order = schedule.order;
  const withheld = [...schedule.cycles.flat(), ...schedule.blocked];
  if (new Set([...order, ...withheld]).size !== order.length + withheld.length ||
      [...order, ...withheld].some(id => !valid.has(id)) ||
      cachedIds.some(id => !valid.has(id)) || new Set(cachedIds).size !== cachedIds.length) {
    throw new TypeError('invalid or overlapping execution schedule/cache');
  }
  const cached = new Set(cachedIds);
  const scheduled = new Set();
  const entries = new Map(snapshot.blocks.map(b => [b.blockId, b]));
  const tasks = [];
  for (const id of order) {
    const block = entries.get(id);
    if (block.parseError !== null) throw new TypeError(`cannot evaluate syntactically invalid block: ${id}`);
    if (typeof sources.get(id) !== 'string') throw new TypeError(`missing source for block: ${id}`);
    const upstream = analysis.graph.getUpstream(id);
    if (!Array.isArray(upstream) || upstream.some(dep => !valid.has(dep))) throw new TypeError('invalid upstream edge');
    for (const dep of upstream) {
      if (!scheduled.has(dep) && !cached.has(dep)) throw new TypeError(`upstream outcome unavailable: ${dep} -> ${id}`);
    }
    const bindings = analysis.bindings.get(id);
    // Frozen plain-data snapshot, not a mutable Map handed across boundaries.
    const providers = Object.freeze([...bindings].map(([name, providerId]) => {
      if (typeof name !== 'string' || !name || !valid.has(providerId) || !upstream.includes(providerId)) {
        throw new TypeError('binding does not match projected upstream graph');
      }
      return Object.freeze({name, providerId});
    }));
    tasks.push(Object.freeze({
      blockId: id,
      taskScopeId: snapshot.taskScopeId,
      source: sources.get(id),
      providers,
      upstream: Object.freeze([...upstream]),
    }));
    scheduled.add(id);
  }
  return Object.freeze({
    tasks: Object.freeze(tasks),
    cycles: Object.freeze(schedule.cycles.map(group => Object.freeze([...group]))),
    blocked: Object.freeze([...schedule.blocked]),
  });
}
