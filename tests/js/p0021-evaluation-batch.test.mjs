import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSemanticEvaluationBatch as prepare} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';
const setup = ({ids=['a','b','c'], edges=[['a','b'],['b','c']], bindings={b:[['x','a']],c:[['y','b']]}, parseError={}}={}) => {
  const upstream = new Map(ids.map(id=>[id,[]]));
  for(const [from,to] of edges)upstream.get(to).push(from);
  const snapshot={taskScopeId:'task',blocks:ids.map(blockId=>({blockId,parseError:parseError[blockId]??null}))};
  const analysis={graph:{nodes:new Set(ids),getUpstream(id){return [...upstream.get(id)];}},bindings:new Map(ids.map(id=>[id,new Map(bindings[id]??[])]))};
  const sources=new Map(ids.map(id=>[id,`${id} := 3`]));
  const schedule={order:[...ids],cycles:[],blocked:[]};
  return {snapshot,analysis,schedule,sources};
};
test('s4: ordered tasks retain source, scope and existing provider IDs',()=>{
 const s=setup();const b=prepare(s.snapshot,s.analysis,s.schedule,s.sources);
 assert.deepEqual(b.tasks.map(t=>t.blockId),['a','b','c']);
 assert.deepEqual(b.tasks[1].providers,[{name:'x',providerId:'a'}]);
 assert.equal(b.tasks[2].taskScopeId,'task');
});
test('s4: source text never reparsed or modified',()=>{
 const s=setup();s.sources.set('b',' b := x^2 // retained');
 assert.equal(prepare(s.snapshot,s.analysis,s.schedule,s.sources).tasks[1].source,' b := x^2 // retained');
});
test('s4: cached upstream can feed a partial recomputation',()=>{
 const s=setup();s.schedule.order=['b','c'];
 assert.deepEqual(prepare(s.snapshot,s.analysis,s.schedule,s.sources,['a']).tasks.map(x=>x.blockId),['b','c']);
});
test('s4: missing upstream result refuses premature evaluation',()=>{
 const s=setup();s.schedule.order=['b','c'];assert.throws(()=>prepare(s.snapshot,s.analysis,s.schedule,s.sources),/upstream outcome unavailable/);
});
test('s4: execution order cannot put consumer before provider',()=>{
 const s=setup();s.schedule.order=['c','a','b'];assert.throws(()=>prepare(s.snapshot,s.analysis,s.schedule,s.sources),/upstream outcome unavailable/);
});
test('s4: invalid syntax cannot be dispatched to evaluator',()=>{
 const s=setup({parseError:{a:'Expected expression'}});assert.throws(()=>prepare(s.snapshot,s.analysis,s.schedule,s.sources),/syntactically invalid/);
});
test('s4: blocked cycles are carried as facts but not dispatched',()=>{
 const s=setup({ids:['a','b'],edges:[['a','b'],['b','a']],bindings:{a:[['b','b']],b:[['a','a']]}});
 s.schedule={order:[],cycles:[['a','b']],blocked:[]};const r=prepare(s.snapshot,s.analysis,s.schedule,s.sources);
 assert.deepEqual(r.tasks,[]);assert.deepEqual(r.cycles,[['a','b']]);
});
test('s4: input graph, sources and bindings are not mutated; output immutable',()=>{
 const s=setup();const r=prepare(s.snapshot,s.analysis,s.schedule,s.sources);
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.tasks[1].providers[0]));
 s.sources.set('b','changed');s.analysis.bindings.get('b').set('z','a');
 assert.equal(r.tasks[1].source,'b := 3');assert.equal(r.tasks[1].providers.length,1);
});
test('s4: mismatch between provider binding and graph is rejected',()=>{
 const s=setup();s.analysis.bindings.get('b').set('x','c');
 assert.throws(()=>prepare(s.snapshot,s.analysis,s.schedule,s.sources),/binding does not match/);
});
test('s4: missing source and duplicate schedule IDs are errors',()=>{
 const s=setup();s.sources.delete('a');assert.throws(()=>prepare(s.snapshot,s.analysis,s.schedule,s.sources),/missing source/);
 s.sources.set('a','a := 1');s.schedule.order=['a','a'];assert.throws(()=>prepare(s.snapshot,s.analysis,s.schedule,s.sources),/overlapping/);
});
