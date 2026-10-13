import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {planSemanticRecomputation} from '../../src/js/semantics/plan-semantic-recomputation.js';
import {orderSemanticRecomputation} from '../../src/js/semantics/order-semantic-recomputation.js';
import {prepareSemanticEvaluationBatch} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';
import {evaluateBoundSourceFunctionCall} from '../../src/js/semantics/evaluate-bound-source-function-call.js';

const block=(id,source)=>({id,source});
const original=[block('f1','f(x):=x^2+3x'),block('ten','f(10)'),block('f2','f(x):=2x+1'),block('three','f(3)')];
const removed=original.slice(1);
function model(blocks){
  const snapshot=deriveSourceSemanticSnapshot(blocks,parse,'task');
  return {snapshot,analysis:projectSemanticDependencyAnalysis(snapshot)};
}
const before=model(original), after=model(removed);
const call=(m,id)=>m.snapshot.blocks.find(b=>b.blockId===id).calls[0];
const plan=planSemanticRecomputation(before.analysis,after.analysis,[]);

test('S42 deleting first definition leaves preceding f(10) unresolved, not rebound forward to f2',()=>{
  assert.equal(call(before,'ten').providerId,'f1');
  assert.deepEqual(call(after,'ten'),{name:'f',candidates:[],providerId:null,classification:'unresolved'});
  assert.deepEqual([...after.analysis.bindings.get('ten')],[]);
  assert.deepEqual(after.analysis.graph.getUpstream('ten'),[]);
});
test('S42 later f(3) keeps its exact f2 binding after deleting the first definition',()=>{
  assert.equal(call(before,'three').providerId,'f2');
  assert.equal(call(after,'three').providerId,'f2');
  assert.deepEqual([...after.analysis.bindings.get('three')],[['f','f2']]);
  assert.deepEqual(after.analysis.graph.getUpstream('three'),['f2']);
});
test('S42 deletion invalidates f(10) only, preserving cached f2 and f(3)',()=>{
  assert.deepEqual([...plan.removed],['f1']);
  assert.deepEqual([...plan.bindingChanges],['ten']);
  assert.deepEqual([...plan.recompute],['ten']);
  const schedule=orderSemanticRecomputation(after.analysis,plan);
  assert.deepEqual(schedule.order,['ten']);
  const batch=prepareSemanticEvaluationBatch(after.snapshot,after.analysis,schedule,new Map(removed.map(b=>[b.id,b.source])),['f2','three']);
  assert.deepEqual(batch.tasks.map(t=>t.blockId),['ten']);
  assert.deepEqual(batch.tasks[0].providers,[]);
});
test('S42 unresolved f(10) fails closed before any evaluator call, no later-provider fallback',async()=>{
  let calls=0;
  await assert.rejects(evaluateBoundSourceFunctionCall({
    snapshot:after.snapshot,blockId:'ten',expectedName:'f',args:[],
    envelope:{blockId:'ten',taskScopeId:'task',providers:[{name:'f',providerId:'f2'}]},
    specs:new Map(),evaluate:async()=>{calls++;throw Error('must not evaluate');},
  }),/no uniquely selected document function provider/);
  assert.equal(calls,0);
});
test('S42 restoring original definition restores f(10) binding without disturbing later f(3)',()=>{
  const restored=planSemanticRecomputation(after.analysis,before.analysis,[]);
  assert.deepEqual([...restored.inserted],['f1']);
  assert.deepEqual([...restored.bindingChanges],['ten']);
  assert.deepEqual([...restored.recompute].sort(),['f1','ten']);
  assert.equal(call(before,'ten').providerId,'f1');
  assert.equal(call(before,'three').providerId,'f2');
});
