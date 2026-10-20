import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';

function make(run = async()=>({kind:'complete'})) {
  const runtime=DocumentRuntime.createSemantic('s96b1');
  runtime.addBlock({id:'a',taskId:'T',type:'formula',source:'a:=2'});
  runtime.addBlock({id:'r',taskId:'T',type:'formula',source:'a+1'});
  let epoch=0, calls=0;
  const getCurrentRevision=()=>`rev-${epoch}`;
  const advanceRevision=()=>{epoch++;};
  const edit=createFormulaEditingSession({runtime,taskId:'T'});
  const history=createDocumentHistorySession({runtime,editingSession:edit,getCurrentRevision,advanceRevision});
  const action=createSemanticCalculateAction({runtime,taskId:'T',
    session:{run:()=>{calls++;return run();}},getCurrentRevision,advanceRevision,
    commitOperations:ops=>history.execute(ops)});
  const enter=()=>submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},editingSession:edit,calculateAction:action});
  return {runtime,edit,history,action,enter,get epoch(){return epoch;},get calls(){return calls;}};
}

test('S96b1 Enter makes one Undo entry, one revision and recalculates once',async()=>{
  const s=make();s.edit.begin('r');s.edit.replaceSource('a+4');
  assert.deepEqual(await s.enter(),{kind:'complete'});
  assert.equal(s.edit.snapshot(),null);assert.equal(s.runtime.getBlock('r').source,'a+4');
  assert.equal(s.epoch,1);assert.equal(s.calls,1);assert.equal(s.history.snapshot().length,1);
  assert.equal(s.history.undo().kind,'applied');assert.equal(s.runtime.getBlock('r').source,'a+1');
  assert.equal(s.history.redo().kind,'applied');assert.equal(s.runtime.getBlock('r').source,'a+4');
  assert.equal(s.epoch,3);
});

test('S96b1 only the exact pending proposal may cross history',()=>{
  const s=make();s.edit.begin('r');s.edit.replaceSource('a+5');
  assert.throws(()=>s.history.execute([{kind:'source',blockId:'r',source:'a+5'}]),/S95O_ACTIVE_DRAFT/);
  s.edit.prepareCommit();
  for (const ops of [
    [{kind:'source',blockId:'r',source:'a+9'}],
    [{kind:'source',blockId:'a',source:'a+5'}],
    [{kind:'source',blockId:'r',source:'a+5'},{kind:'remove',blockId:'a'}],
    [{kind:'remove',blockId:'r'}],
  ]) assert.throws(()=>s.history.execute(ops),/S95O_ACTIVE_DRAFT/);
  assert.equal(s.epoch,0);assert.equal(s.history.snapshot().length,0);
  assert.equal(s.runtime.getBlock('r').source,'a+1');
  const ops=[{kind:'source',blockId:'r',source:'a+5'}];
  assert.equal(s.history.execute(ops).kind,'applied');
  assert.throws(()=>s.history.undo(),/S95O_ACTIVE_DRAFT/);
  s.edit.finishCommit();assert.equal(s.history.undo().kind,'applied');
});

test('S96b1 unchanged Enter does not consume revision/history, still evaluates',async()=>{
  const s=make();s.edit.begin('r');await s.enter();
  assert.equal(s.epoch,0);assert.equal(s.history.snapshot().length,0);
  assert.equal(s.calls,1);assert.equal(s.edit.snapshot(),null);
});

test('S96b1 Worker failure after committed source preserves history and closes editor',async()=>{
  const failure=new Error('WORKER_TIMEOUT');const s=make(async()=>{throw failure;});
  s.edit.begin('r');s.edit.replaceSource('a+7');
  await assert.rejects(s.enter(),e=>e===failure);
  assert.equal(s.runtime.getBlock('r').source,'a+7');
  assert.equal(s.history.snapshot().length,1);assert.equal(s.epoch,1);
  assert.equal(s.edit.snapshot(),null);assert.equal(s.history.undo().kind,'applied');
});

test('S96b1 delete/recreate cannot obtain pending-history acknowledgment',()=>{
  const s=make();s.edit.begin('r');s.edit.replaceSource('a+5');s.edit.prepareCommit();
  s.runtime.applyDocumentTransaction(s.runtime.prepareDocumentTransaction([
    {kind:'remove',blockId:'r'},
    {kind:'insert',blockId:'r',index:1,taskId:'T',source:'a+1'},
  ]));
  assert.throws(()=>s.history.execute([{kind:'source',blockId:'r',source:'a+5'}]),/S95I_BLOCK_IDENTITY_STALE/);
  assert.equal(s.epoch,0);assert.equal(s.history.snapshot().length,0);
  assert.equal(s.runtime.getBlock('r').source,'a+1');
});

test('S96b1 legacy selected Calculate still works without history injection',async()=>{
  const s=make();const getCurrentRevision=()=>`r${s.epoch}`;
  // The existing S95i path owns revision and retains its live object.
  let epoch=0;
  const action=createSemanticCalculateAction({runtime:s.runtime,taskId:'T',
    session:{run:async()=>({kind:'complete'})},getCurrentRevision:()=>`e${epoch}`,
    advanceRevision:()=>{epoch++;}});
  const old=s.runtime.getBlock('r');
  await action.calculate([{blockId:'r',source:'a+13'}]);
  assert.equal(s.runtime.getBlock('r'),old);assert.equal(epoch,1);
  assert.equal(s.runtime.getBlock('r').source,'a+13');
});
