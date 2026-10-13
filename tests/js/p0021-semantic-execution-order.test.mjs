import test from 'node:test';
import assert from 'node:assert/strict';
import {DependencyGraph} from '../../src/js/dependency-graph.js';
import {planSemanticRecomputation} from '../../src/js/semantics/plan-semantic-recomputation.js';
import {orderSemanticRecomputation as order} from '../../src/js/semantics/order-semantic-recomputation.js';
const mk=(nodes,edges=[])=>{
 const graph=new DependencyGraph(),bindings=new Map();
 for(const id of nodes){graph.addNode(id);bindings.set(id,new Map());}
 for(const [from,to] of edges)graph.addEdge(from,to);
 return {graph,bindings};
};
const plan=(analysis,recompute)=>({recompute:new Set(recompute),removed:new Set()});
test('s3: dependencies precede consumers even when insertion order is reversed',()=>{
 const a=mk(['c','b','a'],[['a','b'],['b','c']]);
 assert.deepEqual(order(a,plan(a,['c','b','a'])).order,['a','b','c']);
});
test('s3: independent nodes preserve document order',()=>{
 const a=mk(['d','b','c','a']);assert.deepEqual(order(a,plan(a,['a','b','c'])).order,['b','c','a']);
});
test('s3: unchanged upstream provider is not evaluated again',()=>{
 const a=mk(['x','y','z'],[['x','y'],['y','z']]);
 assert.deepEqual(order(a,plan(a,['y','z'])).order,['y','z']);
});
test('s3: self loop is a cycle and downstream is blocked',()=>{
 const a=mk(['a','b','c'],[['a','a'],['a','b']]);
 const r=order(a,plan(a,['a','b','c']));
 assert.deepEqual(r.order,['c']);assert.deepEqual(r.cycles,[['a']]);assert.deepEqual(r.blocked,['b']);
});
test('s3: multi node cycle is reported, descendants withheld',()=>{
 const a=mk(['a','b','c','d'],[['a','b'],['b','a'],['b','c']]);
 const r=order(a,plan(a,['a','b','c','d']));
 assert.deepEqual(r.order,['d']);assert.deepEqual(r.cycles,[['a','b']]);assert.deepEqual(r.blocked,['c']);
});
test('s3: two disjoint cycles get deterministic ordering',()=>{
 const a=mk(['c','d','a','b'],[['a','b'],['b','a'],['c','d'],['d','c']]);
 assert.deepEqual(order(a,plan(a,['a','b','c','d'])).cycles,[['c','d'],['a','b']]);
});
test('s3: real s2 recomputation plan feeds s3 order',()=>{
 const a=mk(['z','y','x','alone'],[['x','y'],['y','z']]);
 const p=planSemanticRecomputation(a,a,['x']);
 assert.deepEqual(order(a,p).order,['x','y','z']);
});
test('s3: empty plan yields empty order',()=>{
 const a=mk(['x']);const r=order(a,plan(a,[]));
 assert.deepEqual(r,{order:[],cycles:[],blocked:[]});
});
test('s3: rejects missing and deleted targets',()=>{
 const a=mk(['x']);assert.throws(()=>order(a,plan(a,['missing'])),TypeError);
 assert.throws(()=>order(a,{recompute:new Set(['x']),removed:new Set(['x'])}),TypeError);
});
test('s3: does not mutate graph, plan or freeze input',()=>{
 const a=mk(['b','a'],[['a','b']]);const p=plan(a,['a','b']);const r=order(a,p);
 assert.ok(Object.isFrozen(r.order));assert.ok(a.graph.hasEdge('a','b'));
 p.recompute.add('unused');assert.deepEqual(r.order,['a','b']);
});
