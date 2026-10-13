/** P0021 Slice 3: deterministic execution order for an existing recomputation plan.
 * An upstream dependency outside recompute is assumed to have a valid cached
 * outcome, NOT re-evaluated here. Cycles and their downstream consumers are
 * withheld from execution. No runtime mutation, parsing or Python dispatch.
 */
export function orderSemanticRecomputation(analysis, plan) {
  const graph = analysis?.graph;
  if (!(graph?.nodes instanceof Set) || typeof graph.getUpstream !== 'function' ||
      typeof graph.getDownstream !== 'function' || !(analysis.bindings instanceof Map) ||
      !(plan?.recompute instanceof Set) || !(plan?.removed instanceof Set)) {
    throw new TypeError('expected projected analysis and recomputation plan');
  }
  const all=graph.nodes, targets=plan.recompute;
  if ([...targets].some(id=>!all.has(id) || typeof id!=='string') ||
      [...plan.removed].some(id=>all.has(id))) {
    throw new TypeError('recompute must contain retained nodes only');
  }
  if (analysis.bindings.size!==all.size || [...all].some(id=>!analysis.bindings.has(id))) {
    throw new TypeError('graph/binding identities differ');
  }
  // Preserve document-order (graph node insertion order) as tie-breaker.
  const priority=new Map([...all].map((id,i)=>[id,i]));
  const earlier=(a,b)=>priority.get(a)-priority.get(b);
  const indegree=new Map();
  for(const id of targets){
    const upstream=graph.getUpstream(id);
    if(upstream.some(u=>!all.has(u))) throw new TypeError('dangling graph edge');
    indegree.set(id, upstream.filter(u=>targets.has(u)).length);
  }
  const ready=[...targets].filter(id=>indegree.get(id)===0).sort(earlier), ordered=[];
  while(ready.length){
    const id=ready.shift();ordered.push(id);
    for(const next of graph.getDownstream(id)){
      if(!targets.has(next)) continue;
      indegree.set(next,indegree.get(next)-1);
      if(indegree.get(next)===0){ ready.push(next);ready.sort(earlier); }
    }
  }
  const pending=new Set([...targets].filter(id=>!ordered.includes(id)));
  // Tarjan SCC to distinguish actual cycle members from their dependants.
  let index=0;const indices=new Map(),low=new Map(),stack=[],onStack=new Set(),components=[];
  function visit(v){
    indices.set(v,index);low.set(v,index++);stack.push(v);onStack.add(v);
    for(const w of graph.getDownstream(v)){
      if(!pending.has(w))continue;
      if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}
      else if(onStack.has(w)) low.set(v,Math.min(low.get(v),indices.get(w)));
    }
    if(low.get(v)===indices.get(v)){
      const comp=[];let w;do{w=stack.pop();onStack.delete(w);comp.push(w);}while(w!==v);
      comp.sort(earlier);components.push(comp);
    }
  }
  for(const id of [...pending].sort(earlier)) if(!indices.has(id))visit(id);
  const cycles=components.filter(c=>c.length>1 || graph.hasEdge?.(c[0],c[0]));
  cycles.sort((a,b)=>earlier(a[0],b[0]));
  const cycleNodes=new Set(cycles.flat());
  return {
    order:Object.freeze(ordered),
    cycles:Object.freeze(cycles.map(c=>Object.freeze(c))),
    blocked:Object.freeze([...pending].filter(id=>!cycleNodes.has(id)).sort(earlier)),
  };
}
