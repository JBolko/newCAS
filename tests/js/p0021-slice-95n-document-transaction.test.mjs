import {seedSemanticTask} from '../helpers/runtime-fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';

function setup() {
  const runtime = DocumentRuntime.createSemantic('s95n');
  for(const [id,source,taskId] of [
    ['a','a:=2','t'],['f','f(t):=t^2+a','t'],['r','f(3)','t'],['outside','q:=9','other']
  ]) runtime.addBlock({id,type:'formula',taskId,source});
  let notifications = 0;
  runtime.subscribeSemanticChanges(()=>notifications++);
  const current = () => runtime.getBlocks().map(x=>[x.id,x.source,x.taskId]);
  return {runtime,current,get notifications(){return notifications;}};
}

test('95n prepares with no mutation/notification and freezes operations',()=>{
  const s=setup(), before=s.current();
  const p=s.runtime.prepareDocumentTransaction([
    {kind:'source',blockId:'a',source:'a:=5'},
    {kind:'insert',blockId:'boost',index:2,taskId:'t',source:'a:=7'}]);
  assert.deepEqual(s.current(),before);assert.equal(s.notifications,0);
  assert.equal(p.changed,true);assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.inverse));assert.ok(Object.isFrozen(p.forward[0]));
  assert.deepEqual(p.inverse.map(op=>op.kind),['remove','source']);
});
test('95n publishes multi-primitive changes with one dependency notification',()=>{
  const s=setup();const p=s.runtime.prepareDocumentTransaction([
    {kind:'source',blockId:'a',source:'a:=5'},
    {kind:'insert',blockId:'boost',index:1,source:'a:=7',taskId:'t'},
    {kind:'move',blockId:'f',index:3}]);
  const f=s.runtime.getBlock('f');
  const r=s.runtime.applyDocumentTransaction(p);
  assert.equal(r.kind,'applied');assert.equal(s.notifications,1);
  assert.deepEqual(s.current().map(x=>x[0]),['a','boost','r','f','outside']);
  assert.equal(s.runtime.getBlock('f'),f);
  assert.equal(s.runtime.getBlock('a').source,'a:=5');
});
test('95n rejected operations never advance state (including second operation)',()=>{
  const s=setup(), before=s.current();
  const bad=[
    [{kind:'source',blockId:'a',source:'a:=4'},{kind:'remove',blockId:'absent'}],
    [{kind:'insert',blockId:'new',index:0,taskId:'t',source:'5'},{kind:'insert',blockId:'new',index:1,taskId:'t',source:'6'}],
    [{kind:'move',blockId:'a',index:77}],
    [{kind:'source',blockId:'a',source:1}],
    [{kind:'remove',blockId:'outside',source:'illegal'}],
    [{kind:'insert',blockId:'x',index:0,source:'1',taskId:'t',calculation:{status:'success'}}],
    [{kind:'deleteEverything',blockId:'a'}],
  ];
  for(const operations of bad) assert.throws(()=>s.runtime.prepareDocumentTransaction(operations),/S95N_/);
  assert.deepEqual(s.current(),before);assert.equal(s.notifications,0);
});
test('95n inverse preserves deletion identity, original order and source',()=>{
  const s=setup(),before=s.current();
  const plan=s.runtime.prepareDocumentTransaction([
    {kind:'source',blockId:'a',source:'a:=5'},
    {kind:'remove',blockId:'f'},
    {kind:'move',blockId:'outside',index:0},
    {kind:'insert',blockId:'extra',index:2,source:'f(4)',taskId:'t'}]);
  s.runtime.applyDocumentTransaction(plan);
  s.runtime.applyDocumentTransaction(s.runtime.prepareDocumentTransaction(plan.inverse));
  assert.deepEqual(s.current(),before);
  assert.equal(s.runtime.getBlock('f').id,'f');
});
test('95n move no-op and source no-op do not replace blocks or notify',()=>{
  const s=setup(), a=s.runtime.getBlock('a');
  const plan=s.runtime.prepareDocumentTransaction([{kind:'source',blockId:'a',source:'a:=2'},
    {kind:'move',blockId:'a',index:0}]);
  assert.equal(plan.changed,false);
  assert.equal(s.runtime.applyDocumentTransaction(plan).kind,'unchanged');
  assert.equal(s.notifications,0);assert.equal(s.runtime.getBlock('a'),a);
});
test('95n rejects stale and reused plans, without partial document mutation',()=>{
  const s=setup();const before=s.current();
  const plan=s.runtime.prepareDocumentTransaction([{kind:'remove',blockId:'f'}]);
  s.runtime.setBlockSource('a','a:=99');
  const changed=s.current();
  assert.throws(()=>s.runtime.applyDocumentTransaction(plan),/S95N_STALE_PLAN/);
  assert.deepEqual(s.current(),changed);
  assert.throws(()=>s.runtime.applyDocumentTransaction(plan),/S95N_PLAN_INVALID/);
  assert.notDeepEqual(changed,before);
});
test('95n cannot accept plan belonging to another runtime',()=>{
  const a=setup(),b=setup();
  const p=a.runtime.prepareDocumentTransaction([{kind:'remove',blockId:'a'}]);
  assert.throws(()=>b.runtime.applyDocumentTransaction(p),/S95N_PLAN_INVALID/);
  assert.equal(a.runtime.getBlock('a').id,'a');
});
test('95n source commit increments generation and dirties downstream',async()=>{
  const s=setup(),runtime=s.runtime;
  await seedSemanticTask(runtime,'t',{generation:3});
  const p=runtime.prepareDocumentTransaction([{kind:'source',blockId:'a',source:'a:=9'}]);
  runtime.applyDocumentTransaction(p);
  assert.equal(runtime.getBlock('a').calculation.generation,4);
  assert.equal(runtime.getBlock('a').calculation.result,null);
  assert.notEqual(runtime.getBlock('f').calculation.status,'success');
  assert.notEqual(runtime.getBlock('r').calculation.status,'success');
});
test('95n inserted source may be incomplete, without calling evaluator',()=>{
  const s=setup();const p=s.runtime.prepareDocumentTransaction([{kind:'insert',blockId:'invalid',taskId:'t',source:'f(',index:0}]);
  s.runtime.applyDocumentTransaction(p);
  assert.equal(s.runtime.getBlock('invalid').source,'f(');
});
test('95n never accepts a legacy runtime',()=>{
  const r=new DocumentRuntime({calculate(){}},'legacy');
  assert.throws(()=>r.prepareDocumentTransaction([{kind:'remove',blockId:'x'}]),/S95N_SEMANTIC_RUNTIME_REQUIRED/);
});
test('95n throwing subscriber does not strand committed document and reports warning',()=>{
  const s=setup();s.runtime.subscribeSemanticChanges(()=>{throw Error('bad observer');});
  const p=s.runtime.prepareDocumentTransaction([{kind:'source',blockId:'a',source:'a:=3'}]);
  const outcome=s.runtime.applyDocumentTransaction(p);
  assert.equal(s.runtime.getBlock('a').source,'a:=3');
  assert.equal(outcome.notificationErrors,1);
});

test('95n only notifies changed task scopes, not unrelated ones',()=>{
  const s=setup();const scopes=[];
  s.runtime.subscribeSemanticChanges(ids=>scopes.push(ids));
  s.runtime.applyDocumentTransaction(s.runtime.prepareDocumentTransaction([
    {kind:'source',blockId:'a',source:'a:=7'}]));
  assert.deepEqual(scopes,[['t']]);
});
