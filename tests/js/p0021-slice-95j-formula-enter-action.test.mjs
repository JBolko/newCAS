import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';

function setup() {
  const runtime=DocumentRuntime.createSemantic('s95j');
  runtime.addBlock({id:'a',type:'formula',taskId:'A',source:'a:=2'});
  runtime.addBlock({id:'b',type:'formula',taskId:'A',source:'a+1'});
  let revision=0,runs=0,run=async()=>({kind:'complete'});
  const action=createSemanticCalculateAction({runtime,taskId:'A',
    session:{run:()=>{runs++;return run();}},
    getCurrentRevision:()=>`r${revision}`,advanceRevision:()=>{revision++;}});
  const editingSession=createFormulaEditingSession({runtime,taskId:'A'});
  let prevented=0;
  const key=(overrides={})=>({key:'Enter',shiftKey:false,ctrlKey:false,altKey:false,
    metaKey:false,repeat:false,isComposing:false,keyCode:13,
    preventDefault(){prevented++;},...overrides});
  return {runtime,action,editingSession,key,setRun:f=>run=f,
    get revisions(){return revision;},get runs(){return runs;},get prevented(){return prevented;}};
}
const submit=(s,event=s.key())=>submitFormulaEditorEnter({event,editingSession:s.editingSession,calculateAction:s.action});

test('S95j rejects missing UI/EditingSession/calculate capabilities',async()=>{
  await assert.rejects(submitFormulaEditorEnter(),/S95J_ENTER_CONTRACT/);
  await assert.rejects(submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}}}),/S95J_ENTER_CONTRACT/);
});
test('S95j non-Enter, modified Enter, repeated Enter and IME composition are untouched',async()=>{
  const s=setup();s.editingSession.begin('a');s.editingSession.replaceSource('a:=5');
  const keys=[{key:'a'},{key:'Tab'},{shiftKey:true},{ctrlKey:true},{altKey:true},
    {metaKey:true},{repeat:true},{isComposing:true},{keyCode:229}];
  for(const k of keys) assert.equal(await submit(s,s.key(k)),null);
  assert.equal(s.prevented,0);assert.equal(s.runs,0);assert.equal(s.revisions,0);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');
  assert.equal(s.editingSession.snapshot().source,'a:=5');
});
test('S95j Enter commits one prepared draft via existing action then closes editor',async()=>{
  const s=setup();s.editingSession.begin('a');s.editingSession.replaceSource('a:=5');
  const result=await submit(s);
  assert.deepEqual(result,{kind:'complete'});
  assert.equal(s.runtime.getBlock('a').source,'a:=5');
  assert.equal(s.runtime.getBlock('b').source,'a+1');
  assert.equal(s.revisions,1);assert.equal(s.runs,1);assert.equal(s.prevented,1);
  assert.equal(s.editingSession.snapshot(),null);
});
test('S95j unchanged draft still calculates without touching generation or revision',async()=>{
  const s=setup();s.editingSession.begin('a');
  await submit(s);
  assert.equal(s.revisions,0);assert.equal(s.runs,1);
  assert.equal(s.runtime.getBlock('a').calculation.generation,0);
});
test('S95j incomplete text commits as document source without UI parsing',async()=>{
  const s=setup();s.editingSession.begin('a');s.editingSession.replaceSource('a:=');
  await submit(s);
  assert.equal(s.runtime.getBlock('a').source,'a:=');
});
test('S95j stale EditingSession is rejected before source/revision writes',async()=>{
  const s=setup();s.editingSession.begin('a');s.editingSession.replaceSource('a:=3');
  s.runtime.setBlockSource('a','a:=9');
  await assert.rejects(submit(s),/S95I_EDIT_CONFLICT/);
  assert.equal(s.runtime.getBlock('a').source,'a:=9');
  assert.equal(s.revisions,0);assert.equal(s.runs,0);assert.equal(s.prevented,1);
});
test('S95j pending Enter cannot be sent twice while the Worker request is in flight',async()=>{
  const s=setup();let resolve;
  s.setRun(()=>new Promise(r=>{resolve=r;}));
  s.editingSession.begin('a');s.editingSession.replaceSource('a:=6');
  const first=submit(s);
  await assert.rejects(submit(s),/S95I_COMMIT_PENDING/);
  assert.equal(s.runs,1);assert.equal(s.revisions,1);
  resolve({kind:'complete'});await first;
  assert.equal(s.runtime.getBlock('a').source,'a:=6');
  assert.equal(s.editingSession.snapshot(),null);
});
test('S95j failure before source commit allows draft to be corrected and submitted again',async()=>{
  const s=setup();let calls=0;
  const rejected={calculate:()=>{calls++;throw new Error('S95E_BLOCK_NOT_IN_TASK');}};
  s.editingSession.begin('a');s.editingSession.replaceSource('a:=8');
  await assert.rejects(submitFormulaEditorEnter({event:s.key(),editingSession:s.editingSession,
    calculateAction:rejected}),/S95E_BLOCK_NOT_IN_TASK/);
  assert.equal(calls,1);assert.equal(s.runtime.getBlock('a').source,'a:=2');
  assert.equal(s.editingSession.snapshot().pending,false);
  await submit(s);
  assert.equal(s.runtime.getBlock('a').source,'a:=8');
});
test('S95j Worker failure after source commit retains authoritative source and closes editor',async()=>{
  const s=setup();const failure=new Error('WORKER_TIMEOUT');
  s.setRun(async()=>{throw failure;});
  s.editingSession.begin('a');s.editingSession.replaceSource('a:=12');
  await assert.rejects(submit(s),actual=>actual===failure);
  assert.equal(s.runtime.getBlock('a').source,'a:=12');
  assert.equal(s.editingSession.snapshot(),null);
  assert.equal(s.runs,1); // No implicit restart/replay.
});
test('S95j cannot submit without an active EditingSession; runtime remains untouched',async()=>{
  const s=setup();await assert.rejects(submit(s),/S95I_NO_ACTIVE_DRAFT/);
  assert.equal(s.revisions,0);assert.equal(s.runs,0);
});
test('S95j accidental Enter cannot retarget a removed/recreated block',async()=>{
  const s=setup();s.editingSession.begin('a');s.editingSession.replaceSource('a:=5');
  s.runtime.removeBlock('a');s.runtime.insertBlock({id:'a',type:'formula',taskId:'A',source:'a:=2'},0);
  await assert.rejects(submit(s),/S95I_BLOCK_IDENTITY_STALE/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');assert.equal(s.runs,0);
});
