/** S98c F5: contain the retained non-history action; no callback rollback. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';
import {seedSemanticTask} from '../helpers/runtime-fixtures.js';

function setup() {
  const runtime=DocumentRuntime.createSemantic('s98c-guard');
  for(const [id,source] of [['a','a:=2'],['b','b:=a+1'],['c','c:=b+1']])
    runtime.addBlock({id,type:'formula',taskId:'T',source});
  let epoch=0;
  const make=(callback=()=>{},extra={})=>createFormulaStructuralAction({runtime,taskId:'T',
    getCurrentRevision:()=>String(epoch),advanceRevision:()=>{epoch++;callback();},...extra});
  return {runtime,make,get epoch(){return epoch;}};
}
const rows=rt=>rt.getBlocks().map(b=>({id:b.id,type:b.type,taskId:b.taskId,
  source:b.source,generation:b.calculation?.generation,status:b.calculation?.status}));
const removeC={kind:'remove',blockId:'c'};

for(const missing of [undefined,null,17])
test(`non-history construction requires stamp API before revision callbacks: ${missing}`,()=>{
  const s=setup(),before=rows(s.runtime);let reads=0,advances=0;
  s.runtime.getDocumentMutationIdentity=missing;
  assert.throws(()=>s.make(()=>{},{getCurrentRevision:()=>{reads++;return '0';},
    advanceRevision:()=>{advances++;s.runtime.removeBlock('a');}}),/S95L_ACTION_CONTRACT/);
  assert.equal(reads,0);assert.equal(advances,0);assert.deepEqual(rows(s.runtime),before);
});

test('history-owned injection does not acquire a new stamp API requirement',()=>{
  const s=setup();s.runtime.getDocumentMutationIdentity=undefined;let commits=0;
  const action=s.make(()=>{throw Error('DOUBLE_OWNER');},{commitOperations:ops=>{
    commits++;assert.deepEqual(ops,[removeC]);return {kind:'unchanged'};
  }});
  assert.deepEqual(action.apply(removeC),{kind:'unchanged'});
  assert.equal(commits,1);assert.equal(s.epoch,0);assert.ok(s.runtime.getBlock('c'));
});

test('generation mutation from success cannot hide behind stable live views',async()=>{
  const s=setup();await seedSemanticTask(s.runtime,'T');
  const view=s.runtime.getBlock('b'),before=rows(s.runtime),stamp=s.runtime.getDocumentMutationIdentity();
  assert.equal(view.calculation.status,'success');
  const action=s.make(()=>s.runtime.markBlockDirty('b'));
  assert.throws(()=>action.apply(removeC),/S95L_STRUCTURE_CHANGED_DURING_REVISION/);
  assert.equal(s.runtime.getBlock('b'),view);
  assert.equal(s.runtime.getDocumentMutationIdentity(),stamp,'calculation is not a document mutation');
  assert.equal(view.calculation.generation,before[1].generation+1);
  assert.equal(view.calculation.status,'dirty');assert.equal(view.calculation.result,null);
  assert.ok(s.runtime.getBlock('c'),'requested remove never starts');
  assert.equal(s.epoch,1,'callback epoch and dirtying are not rolled back by this guard');
});

for(const [name,callback] of [
  ['source',rt=>rt.setBlockSource('b','b:=99')],
  ['same-source write',rt=>rt.setBlockSource('b','b:=a+1')],
  ['source ABA',rt=>{rt.setBlockSource('b','b:=99');rt.setBlockSource('b','b:=a+1');}],
  ['insert',rt=>rt.insertBlock({id:'x',type:'formula',taskId:'T',source:'x:=7'},1)],
  ['remove',rt=>rt.removeBlock('b')],
  ['move',rt=>rt.moveBlock('b',0)],
  ['move ABA',rt=>{rt.moveBlock('b',0);rt.moveBlock('b',1);}],
  ['same-ID recreate',rt=>{rt.removeBlock('b');rt.insertBlock({id:'b',type:'formula',taskId:'T',source:'b:=a+1'},1);}],
])test(`revision callback ${name} is detected before requested structural write`,()=>{
  const s=setup(),before=rows(s.runtime),view=s.runtime.getBlock('b'),stamp=s.runtime.getDocumentMutationIdentity();
  assert.throws(()=>s.make(()=>callback(s.runtime)).apply(removeC),/S95L_STRUCTURE_CHANGED_DURING_REVISION/);
  assert.ok(s.runtime.getBlock('c'));assert.equal(s.epoch,1);
  assert.notEqual(s.runtime.getDocumentMutationIdentity(),stamp);
  if(name==='source'){
    assert.equal(s.runtime.getBlock('b'),view);assert.equal(before[1].source,'b:=a+1');
    assert.equal(view.source,'b:=99','callback side effect remains; no rollback claim');
  }
  if(name==='same-ID recreate')assert.notEqual(s.runtime.getBlock('b'),view);
});

test('no-op move preserves stamp, detached state and host revision',()=>{
  const s=setup(),before=rows(s.runtime),stamp=s.runtime.getDocumentMutationIdentity();
  assert.deepEqual(s.make(()=>{throw Error('unexpected callback');}).apply({kind:'move',blockId:'b',index:1}),{kind:'unchanged'});
  assert.deepEqual(rows(s.runtime),before);assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);assert.equal(s.epoch,0);
});
