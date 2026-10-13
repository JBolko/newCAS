import test from 'node:test';
import assert from 'node:assert/strict';
import {DependencyGraph} from '../../src/js/dependency-graph.js';
import {planSemanticRecomputation as plan} from '../../src/js/semantics/plan-semantic-recomputation.js';
const analysis=(nodes, edges=[],bindings={})=>{
 const graph=new DependencyGraph();const map=new Map();
 for(const id of nodes){graph.addNode(id);map.set(id,new Map(Object.entries(bindings[id]||{})));}
 for(const [from,to] of edges)graph.addEdge(from,to);
 return {graph,bindings:map};
};
const ids=s=>[...s].sort();
test('P0021 s2: unchanged snapshot schedules no recomputations',()=>{
 const a=analysis(['x','y'],[['x','y']],{y:{x:'x'}});
 assert.deepEqual(ids(plan(a,a).recompute),[]);
});
test('P0021 s2: source change propagates transitively but not sideways',()=>{
 const a=analysis(['x','y','z','independent'],[['x','y'],['y','z']],{y:{x:'x'},z:{y:'y'}});
 assert.deepEqual(ids(plan(a,a,['x']).recompute),['x','y','z']);
});
test('P0021 s2: binding change alone invalidates reader and downstream',()=>{
 const old=analysis(['w1','w2','reader','next'],[['w1','reader'],['reader','next']],{reader:{x:'w1'},next:{reader:'reader'}});
 const now=analysis(['w1','w2','reader','next'],[['w2','reader'],['reader','next']],{reader:{x:'w2'},next:{reader:'reader'}});
 const p=plan(old,now);
 assert.deepEqual(ids(p.bindingChanges),['reader']);
 assert.deepEqual(ids(p.recompute),['next','reader']);
});
test('P0021 s2: deleted provider invalidates its old descendants',()=>{
 const old=analysis(['gone','read','later'],[['gone','read'],['read','later']],{read:{x:'gone'},later:{read:'read'}});
 const now=analysis(['read','later'],[['read','later']],{later:{read:'read'}});
 const p=plan(old,now);
 assert.deepEqual(ids(p.removed),['gone']);
 assert.deepEqual(ids(p.recompute),['later','read']);
});
test('P0021 s2: inserted provider triggers changed binding of retained reader',()=>{
 const old=analysis(['read'],[],{});
 const now=analysis(['write','read'],[['write','read']],{read:{x:'write'}});
 const p=plan(old,now);
 assert.deepEqual(ids(p.inserted),['write']);
 assert.deepEqual(ids(p.recompute),['read','write']);
});
test('P0021 s2: uses old and new dependency graphs for conservative impact',()=>{
 const old=analysis(['a','b','c'],[['a','b'],['b','c']],{b:{x:'a'},c:{x:'b'}});
 const now=analysis(['a','b','c'],[['a','c']],{c:{x:'a'}});
 assert.deepEqual(ids(plan(old,now,['a']).recompute),['a','b','c']);
});
test('P0021 s2: failed mathematical result does not suppress invalidation',()=>{
 const a=analysis(['broken-writer','reader'],[['broken-writer','reader']],{reader:{x:'broken-writer'}});
 assert.deepEqual(ids(plan(a,a,['broken-writer']).recompute),['broken-writer','reader']);
});
test('P0021 s2: rejects unknown changed IDs and malformed projections',()=>{
 const a=analysis(['x']);assert.throws(()=>plan(a,a,['missing']),TypeError);
 assert.throws(()=>plan({graph:a.graph,bindings:new Map()},a),TypeError);
});
test('P0021 s2: inputs remain unchanged and output is independent',()=>{
 const a=analysis(['x','y'],[['x','y']],{y:{x:'x'}});
 const p=plan(a,a,['x']);p.recompute.clear();
 assert.equal(a.graph.hasEdge('x','y'),true);
 assert.equal(a.bindings.get('y').get('x'),'x');
});
