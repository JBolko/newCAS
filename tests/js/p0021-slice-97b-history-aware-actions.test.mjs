/** S97b RED -> GREEN: one existing history authority for selected editor actions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';
import {expression} from '../../src/js/values/value.js';
function setup(run=async()=>({kind:'complete'})) {
  const runtime=DocumentRuntime.createSemantic('s97b');
  for(const [id,source] of [['a','a:=2'],['b','a+1'],['c','a+2']])
    runtime.addBlock({id,type:'formula',taskId:'T',source});
  let epoch=0,runs=0,commits=0;
  const getCurrentRevision=()=>String(epoch),advanceRevision=()=>{epoch++;};
  const editing=createFormulaEditingSession({runtime,taskId:'T'});
  const history=createDocumentHistorySession({runtime,editingSession:editing,getCurrentRevision,advanceRevision});
  const commitOperations=ops=>{commits++;return history.execute(ops);};
  const common={runtime,taskId:'T',getCurrentRevision,
    advanceRevision:()=>{throw new Error('DOUBLE_COMMIT_OWNER');},commitOperations};
  const structure=createFormulaStructuralAction({...common,editingSession:editing});
  const calculate=createSemanticCalculateAction({...common,session:{run:()=>{runs++;return run();}}});
  const rows=()=>runtime.getBlocks().map(({id,source})=>({blockId:id,source}));
  const enter=()=>submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},
    editingSession:editing,calculateAction:calculate});
  return {runtime,editing,history,structure,calculate,rows,enter,getCurrentRevision,advanceRevision,
    get epoch(){return epoch;},get runs(){return runs;},get commits(){return commits;}};
}
const full={reconcileStructure:true};

for(const operation of [
  {kind:'insert',blockId:'x',index:1,source:'a:=5'},
  {kind:'remove',blockId:'b'},
  {kind:'move',blockId:'b',index:2},
])test('S97b history-owned structure '+operation.kind+' has one revision and Undo entry',()=>{
  const s=setup(),before=s.rows();
  const outcome=s.structure.apply(operation);
  assert.equal(outcome.kind,'applied');assert.equal(outcome.revision,'1');
  assert.equal(s.epoch,1);assert.equal(s.commits,1);assert.equal(s.history.snapshot().length,1);
  s.history.undo();assert.deepEqual(s.rows(),before);
  s.history.redo();assert.equal(s.epoch,3);
});

test('S97b structure no-op crosses history guard without truncating redo',()=>{
  const s=setup();s.history.execute([{kind:'source',blockId:'a',source:'a:=5'}]);s.history.undo();
  const before=s.history.snapshot(),epoch=s.epoch,stamp=s.runtime.getDocumentMutationIdentity();
  assert.deepEqual(s.structure.apply({kind:'move',blockId:'a',index:0}),{kind:'unchanged'});
  assert.deepEqual(s.history.snapshot(),before);assert.equal(s.epoch,epoch);
  assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
});

test('S97b structure injection requires a synchronous acceptance outcome, with no direct fallback',()=>{
  const s=setup();
  const action=createFormulaStructuralAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,commitOperations:()=>undefined});
  assert.throws(()=>action.apply({kind:'remove',blockId:'b'}),/S97B_SOURCE_NOT_ACCEPTED/);
  assert.ok(s.runtime.getBlock('b'));assert.equal(s.epoch,0);
});

test('S97b structural commit injection is validated at construction',()=>{
  const s=setup();
  assert.throws(()=>createFormulaStructuralAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,commitOperations:17}),/S95L_ACTION_CONTRACT/);
});

test('S97b whole document source/order/insert/remove is ONE atomic history publication',async()=>{
  const s=setup(),before=s.rows();let notifications=0,seen;
  s.runtime.subscribeSemanticChanges(()=>{notifications++;seen=s.rows();});
  const proposal=[{blockId:'c',source:'a+9'},{blockId:'new',source:'a:=7'},{blockId:'a',source:'a:=5'}];
  assert.equal((await s.calculate.calculate(proposal,full)).kind,'complete');
  assert.deepEqual(s.rows(),proposal);assert.deepEqual(seen,proposal);assert.equal(notifications,1);
  assert.equal(s.epoch,1);assert.equal(s.commits,1);assert.equal(s.runs,1);
  assert.equal(s.history.snapshot().length,1);
  s.history.undo();assert.deepEqual(s.rows(),before);assert.equal(s.epoch,2);
  s.history.redo();assert.deepEqual(s.rows(),proposal);assert.equal(s.epoch,3);
});

test('S97b unchanged whole-document Calculate preserves redo and still evaluates once',async()=>{
  const s=setup();s.history.execute([{kind:'source',blockId:'a',source:'a:=5'}]);s.history.undo();
  const before=s.history.snapshot(),epoch=s.epoch;
  await s.calculate.calculate(s.rows(),full);
  assert.deepEqual(s.history.snapshot(),before);assert.equal(s.epoch,epoch);
  assert.equal(s.runs,1);assert.equal(s.commits,1);
});

test('S97b unchanged whole-document Calculate does not bypass foreign-mutation guard',async()=>{
  const s=setup();s.runtime.setBlockSource('a','a:=2');
  await assert.rejects(s.calculate.calculate(s.rows(),full),/S95O_HISTORY_DIVERGED/);
  assert.equal(s.runs,0);assert.equal(s.epoch,0);
});

test('S97b full-document mode requires a history commit owner before any writes',async()=>{
  const s=setup();const action=createSemanticCalculateAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,session:{run:async()=>({kind:'complete'})}});
  await assert.rejects(action.calculate([{blockId:'a',source:'a:=5'}],full),/S97B_DOCUMENT_CONTRACT/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');assert.equal(s.epoch,0);
});

for(const rows of [[],[{blockId:'a',source:'a:=5'},{blockId:'a',source:'4'}],
  [{blockId:'new',source:'5'},{blockId:'bad',source:null}]])
test('S97b invalid full-document proposal is rejected before history/revision',async()=>{
  const s=setup(),before=s.rows();
  await assert.rejects(s.calculate.calculate(rows,full),/S95E_DRAFTS_INVALID/);
  assert.deepEqual(s.rows(),before);assert.equal(s.epoch,0);assert.equal(s.runs,0);
  assert.equal(s.history.snapshot().length,0);
});

test('S97b full-document mode rejects documents containing other tasks or text',async()=>{
  for(const block of [{id:'foreign',type:'formula',taskId:'OTHER',source:'2'},
    {id:'text',type:'text',source:'paragraph'}]){
    const s=setup();s.runtime.addBlock(block);
    const action=createSemanticCalculateAction({runtime:s.runtime,taskId:'T',
      getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,
      commitOperations:()=>{throw new Error('must preflight');},session:{run:async()=>({kind:'complete'})}});
    await assert.rejects(action.calculate([{blockId:'a',source:'a:=5'}],full),/S97B_DOCUMENT_CONTRACT/);
    assert.ok(s.runtime.getBlock(block.id));assert.equal(s.epoch,0);
  }
});

test('S97b source-only history Calculate retains task isolation in a multi-task document',async()=>{
  const s=setup();s.runtime.addBlock({id:'foreign',type:'formula',taskId:'OTHER',source:'2'});
  const history=createDocumentHistorySession({runtime:s.runtime,getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision});
  const action=createSemanticCalculateAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,
    commitOperations:ops=>history.execute(ops),session:{run:async()=>({kind:'complete'})}});
  await action.calculate([{blockId:'a',source:'a:=5'}]);
  assert.equal(history.snapshot().length,1);assert.equal(s.runtime.getBlock('foreign').source,'2');
});

test('S97b active draft blocks compound reconcile and structure without losing draft',async()=>{
  const s=setup();s.editing.begin('a');s.editing.replaceSource('a:=');
  await assert.rejects(s.calculate.calculate([{blockId:'new',source:'5'}],full),/S95O_ACTIVE_DRAFT/);
  assert.throws(()=>s.structure.apply({kind:'remove',blockId:'b'}),/S95L_ACTIVE_FORMULA_DRAFT/);
  assert.equal(s.editing.snapshot().source,'a:=');assert.equal(s.epoch,0);
});

test('S97b Enter, structure and whole-document edits share one linear history',async()=>{
  const s=setup(),initial=s.rows();
  s.editing.begin('a');s.editing.replaceSource('a:=5');await s.enter();
  s.structure.apply({kind:'insert',blockId:'x',index:1,source:'a:=7'});
  await s.calculate.calculate([{blockId:'x',source:'a:=9'},{blockId:'a',source:'a:=5'},
    {blockId:'b',source:'a+1'}],full);
  assert.equal(s.history.snapshot().length,3);assert.equal(s.epoch,3);
  s.history.undo();s.history.undo();s.history.undo();assert.deepEqual(s.rows(),initial);
  s.history.redo();s.structure.apply({kind:'remove',blockId:'c'});
  assert.equal(s.history.snapshot().canRedo,false);assert.equal(s.epoch,8);
});

test('S97b failed semantic publication rolls back source AND structure with no Undo record',async()=>{
  const s=setup(),before=s.rows(),stamp=s.runtime.getDocumentMutationIdentity();
  const derive=s.runtime.deriveSemanticTask;let calls=0;
  s.runtime.deriveSemanticTask=function(...args){if(++calls===2)throw new Error('PUBLISH_FAILURE');return derive.apply(this,args);};
  try{await assert.rejects(s.calculate.calculate([{blockId:'new',source:'a:=9'}],full),/PUBLISH_FAILURE/);}
  finally{s.runtime.deriveSemanticTask=derive;}
  assert.deepEqual(s.rows(),before);assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
  assert.equal(s.history.snapshot().length,0);assert.equal(s.runs,0);assert.equal(s.epoch,1);
});

test('S97b Worker failure after compound commit preserves authority and Undo',async()=>{
  const failure=new Error('WORKER_TIMEOUT');const s=setup(async()=>{throw failure;});
  const before=s.rows();
  await assert.rejects(s.calculate.calculate([{blockId:'new',source:'a:=9'}],full),e=>e===failure);
  assert.equal(s.runtime.getBlock('new').source,'a:=9');assert.equal(s.history.snapshot().length,1);
  s.history.undo();assert.deepEqual(s.rows(),before);
});

test('S97b compound publication isolates observers and records history',async()=>{
  const s=setup();s.runtime.subscribeSemanticChanges(()=>{throw new Error('observer');});
  await s.calculate.calculate([{blockId:'new',source:'a:=9'}],full);
  assert.equal(s.history.snapshot().length,1);assert.equal(s.history.undo().kind,'applied');
});

test('S97b single-flight protects whole-document proposals before their commit',async()=>{
  let release;const s=setup(()=>new Promise(resolve=>{release=resolve;}));
  const first=s.calculate.calculate(s.rows());
  try{
    await assert.rejects(s.calculate.calculate([{blockId:'new',source:'9'}],full),/S95E_ACTION_ALREADY_RUNNING/);
    assert.equal(s.runtime.getBlock('new'),null);assert.equal(s.history.snapshot().length,0);
  }finally{release({kind:'complete'});await first;}
});

test('S97b structure revision ABA guard remains effective without history injection',()=>{
  const s=setup();let tick=0;
  const action=createFormulaStructuralAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:()=>String(tick),advanceRevision:()=>{tick++;s.runtime.moveBlock('b',2);s.runtime.moveBlock('b',1);}});
  assert.throws(()=>action.apply({kind:'remove',blockId:'c'}),/S95L_STRUCTURE_CHANGED_DURING_REVISION/);
  assert.ok(s.runtime.getBlock('c'));
});

test('S97b structural history edit invalidates an in-flight semantic result',async()=>{
  const s=setup();let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const pending=s.runtime.evaluateAndCommitSemanticTask('T',{revision:s.getCurrentRevision(),
    getCurrentRevision:s.getCurrentRevision,evaluate:async task=>{await gate;return {blockId:task.blockId,status:'success',
      value:expression({op:'integer',value:'999'})};}});
  try{s.structure.apply({kind:'remove',blockId:'b'});}
  finally{release();}
  assert.equal((await pending).kind,'stale');assert.equal(s.runtime.getBlock('a').calculation.result,null);
});
