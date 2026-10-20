/** S96b.2 accepted source-identity and history-integrated Enter contracts.
 * Original RED probes are retained alongside adversarial GREEN acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {expression} from '../../src/js/values/value.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';

function make(run=async()=>({kind:'complete'})) {
  const rt=DocumentRuntime.createSemantic('s96b2');
  rt.addBlock({id:'r',type:'formula',taskId:'T',source:'1+2'});
  let epoch=0;
  const edit=createFormulaEditingSession({runtime:rt,taskId:'T'});
  const getCurrentRevision=()=>`rev-${epoch}`;
  const advanceRevision=()=>{epoch++;};
  const history=createDocumentHistorySession({runtime:rt,editingSession:edit,getCurrentRevision,advanceRevision});
  const action=createSemanticCalculateAction({runtime:rt,taskId:'T',getCurrentRevision,advanceRevision,
    commitOperations:ops=>history.execute(ops),session:{run}});
  const enter=()=>submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},editingSession:edit,calculateAction:action});
  return {rt,edit,history,action,enter,getCurrentRevision,get epoch(){return epoch;}};
}

test('S96b2 RED: after accepted history source commit an intervening ABA source edit invalidates ACK',()=>{
  const s=make();s.edit.begin('r');s.edit.replaceSource('7+9');
  const source=s.edit.prepareCommit();
  assert.equal(s.history.execute([{kind:'source',...source}]).kind,'applied');
  s.rt.setBlockSource('r','10+11');
  s.rt.setBlockSource('r','7+9'); // Same final text and object, different edit history.
  assert.throws(()=>s.edit.finishCommit(),/S96B_EDIT_CONFLICT|S95I_EDIT_CONFLICT/);
  assert.equal(s.edit.snapshot().pending,true);
});

test('S96b2 RED: accepted Enter source releases draft before delayed Worker resolves',async()=>{
  let release;
  const s=make(()=>new Promise(resolve=>{release=resolve;}));
  s.edit.begin('r');s.edit.replaceSource('7+9');
  const evaluating=s.enter(); // source commit is synchronous, worker remains pending
  assert.equal(s.rt.getBlock('r').source,'7+9');
  assert.equal(s.history.snapshot().length,1);
  assert.equal(s.edit.snapshot(),null,'accepted document commit must release draft, not wait for evaluation');
  assert.equal(s.history.undo().kind,'applied');
  release({kind:'complete'});
  await evaluating;
  assert.equal(s.epoch,2);
});

test('S96b2 identity changes on edits/undo/recreate, but not calculation, move or no-op',()=>{
  const s=make(), token=()=>s.rt.getBlockSourceIdentity('r');
  const initial=token();assert.ok(initial);
  s.rt.markBlockDirty('r');assert.equal(token(),initial);
  const apply=ops=>s.rt.applyDocumentTransaction(s.rt.prepareDocumentTransaction(ops));
  apply([{kind:'source',blockId:'r',source:'1+2'}]);assert.equal(token(),initial);
  s.history.execute([{kind:'source',blockId:'r',source:'3+4'}]);
  const changed=token();assert.notEqual(changed,initial);
  s.history.undo();assert.notEqual(token(),initial);assert.notEqual(token(),changed);
  const restored=token();
  s.history.execute([{kind:'remove',blockId:'r'}]);assert.equal(token(),null);
  s.history.undo();assert.notEqual(token(),restored);
  s.rt.addBlock({id:'x',type:'formula',taskId:'T',source:'5'});
  const beforeMove=token();s.rt.moveBlock('r',1);assert.equal(token(),beforeMove);
  const beforeDirect=token();s.rt.setBlockSource('r','8');assert.notEqual(token(),beforeDirect);
});

test('S96b2 prepare and rejected publication preserve source identity',()=>{
  const s=make(), original=s.rt.getBlockSourceIdentity('r');
  const plan=s.rt.prepareDocumentTransaction([{kind:'source',blockId:'r',source:'7+9'}]);
  assert.equal(s.rt.getBlockSourceIdentity('r'),original);
  const derive=s.rt.deriveSemanticTask;let calls=0;
  s.rt.deriveSemanticTask=function(...args){if(++calls===2)throw new Error('DERIVE');return derive.apply(this,args);};
  assert.throws(()=>s.rt.applyDocumentTransaction(plan),/DERIVE/);
  s.rt.deriveSemanticTask=derive;
  assert.equal(s.rt.getBlockSourceIdentity('r'),original);
  calls=0;s.rt.deriveSemanticTask=function(...args){if(++calls===2)throw new Error('DERIVE');return derive.apply(this,args);};
  assert.throws(()=>s.rt.setBlockSource('r','7+9'),/DERIVE/);
  s.rt.deriveSemanticTask=derive;
  assert.equal(s.rt.getBlockSourceIdentity('r'),original);
});

test('S96b2 ACK cannot finish after delete/recreate with accepted source',()=>{
  const s=make();s.edit.begin('r');s.edit.replaceSource('7+9');
  s.history.execute([{kind:'source',...s.edit.prepareCommit()}]);
  s.rt.removeBlock('r');s.rt.addBlock({id:'r',type:'formula',taskId:'T',source:'7+9'});
  assert.throws(()=>s.edit.finishCommit(),/S95I_BLOCK_IDENTITY_STALE|S96B_EDIT_CONFLICT/);
});

test('S96b2 unchanged Enter releases before evaluation and preserves redo',async()=>{
  let release;const s=make(()=>new Promise(resolve=>{release=resolve;}));
  s.history.execute([{kind:'source',blockId:'r',source:'9'}]);s.history.undo();
  const before=s.history.snapshot(),epoch=s.epoch;
  s.edit.begin('r');const pending=s.enter();
  try {
    assert.equal(s.edit.snapshot(),null);
    assert.deepEqual(s.history.snapshot(),before);assert.equal(s.epoch,epoch);
  } finally {release({kind:'complete'});await pending;}
});

for(const fails of [false,true]) test('S96b2 late Worker '+(fails?'failure':'success')+' leaves a newer draft intact',async()=>{
  let resolve,reject;
  const failure=new Error('WORKER_TIMEOUT');
  const s=make(()=>new Promise((a,b)=>{resolve=a;reject=b;}));
  s.edit.begin('r');s.edit.replaceSource('7+9');
  const pending=s.enter();const settled=pending.then(value=>({value}),error=>({error}));
  try {
    assert.equal(s.edit.snapshot(),null);
    s.edit.begin('r');s.edit.replaceSource('new draft');
    const newer=s.edit.snapshot();
    if(fails)reject(failure);else resolve({kind:'complete'});
    const result=await settled;
    if(fails)assert.equal(result.error,failure);else assert.equal(result.value.kind,'complete');
    assert.deepEqual(s.edit.snapshot(),newer);
  } finally {resolve({kind:'complete'});await settled;}
});

test('S96b2 released editor does not bypass Calculate single-flight',async()=>{
  let release;const s=make(()=>new Promise(resolve=>{release=resolve;}));
  s.edit.begin('r');s.edit.replaceSource('7+9');const pending=s.enter();
  try {
    assert.equal(s.edit.snapshot(),null);
    s.edit.begin('r');s.edit.replaceSource('8+9');
    await assert.rejects(s.enter(),/S95E_ACTION_ALREADY_RUNNING/);
    assert.equal(s.edit.snapshot().pending,false);
    assert.equal(s.rt.getBlock('r').source,'7+9');assert.equal(s.epoch,1);
  } finally {release({kind:'complete'});await pending;}
});

test('S96b2 acceptance callback failure preserves committed source and Undo',async()=>{
  const s=make();const failure=new Error('ACCEPT_CALLBACK');let runs=0;
  const action=createSemanticCalculateAction({runtime:s.rt,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:()=>{throw new Error('wrong owner');},
    commitOperations:ops=>s.history.execute(ops),session:{run:async()=>{runs++;}}});
  await assert.rejects(action.calculate([{blockId:'r',source:'7+9'}],
    {onSourceAccepted:()=>{throw failure;}}),e=>e===failure);
  assert.equal(s.rt.getBlock('r').source,'7+9');assert.equal(s.history.snapshot().length,1);
  assert.equal(s.epoch,1);assert.equal(runs,0);assert.equal(s.history.undo().kind,'applied');
});

test('S96b2 real runtime rejects abandoned Enter evaluation after Undo',async()=>{
  const s=make();let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const action=createSemanticCalculateAction({runtime:s.rt,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:()=>{throw new Error('wrong owner');},
    commitOperations:ops=>s.history.execute(ops),
    session:{run:()=>s.rt.evaluateAndCommitSemanticTask('T',{
      revision:s.getCurrentRevision(),getCurrentRevision:s.getCurrentRevision,
      evaluate:async task=>{await gate;return {blockId:task.blockId,status:'success',
        value:expression({op:'integer',value:'16'})};},
    })}});
  s.edit.begin('r');s.edit.replaceSource('7+9');
  const pending=submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},
    editingSession:s.edit,calculateAction:action});
  try {
    assert.equal(s.edit.snapshot(),null);s.history.undo();
  } finally {release();}
  assert.equal((await pending).kind,'stale');assert.equal(s.epoch,2);
  assert.equal(s.rt.getBlock('r').source,'1+2');
  assert.equal(s.rt.getBlock('r').calculation.result,null);
});

test('S96b2 history publication failure leaves a retryable draft and no Undo entry',async()=>{
  const s=make();const derive=s.rt.deriveSemanticTask;let calls=0;
  s.rt.deriveSemanticTask=function(...args){if(++calls===2)throw new Error('DERIVE');return derive.apply(this,args);};
  s.edit.begin('r');s.edit.replaceSource('7+9');
  await assert.rejects(s.enter(),/DERIVE/);s.rt.deriveSemanticTask=derive;
  assert.equal(s.rt.getBlock('r').source,'1+2');
  assert.equal(s.edit.snapshot().pending,false);assert.equal(s.history.snapshot().length,0);
  assert.equal((await s.enter()).kind,'complete');
});

test('S96b2 failure during Enter source-accepted callback never retries an accepted edit',async()=>{
  const s=make();let retries=0;
  const failure=new Error('FINISH_CALLBACK');
  const wrapped={...s.edit,finishCommit(){s.edit.finishCommit();s.edit.begin('r');throw failure;},
    retryDraft(){retries++;return s.edit.retryDraft();}};
  s.edit.begin('r');s.edit.replaceSource('7+9');
  await assert.rejects(submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},
    editingSession:wrapped,calculateAction:s.action}),e=>e===failure);
  assert.equal(retries,0);assert.equal(s.edit.snapshot().pending,false);
  assert.equal(s.history.snapshot().length,1);assert.equal(s.rt.getBlock('r').source,'7+9');
});
