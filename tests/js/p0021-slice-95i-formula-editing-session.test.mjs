import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';

function make() {
  const runtime=DocumentRuntime.createSemantic('s95i');
  runtime.addBlock({id:'a',type:'formula',taskId:'A',source:'a:=2'});
  runtime.addBlock({id:'result',type:'formula',taskId:'A',source:'a+1'});
  runtime.addBlock({id:'other',type:'formula',taskId:'B',source:'b:=20'});
  runtime.addBlock({id:'text',type:'text',source:'hello'});
  const editing=createFormulaEditingSession({runtime,taskId:'A'});
  let revision='r0', rev=0, calls=0;
  let run=async()=>({kind:'complete'});
  const action=createSemanticCalculateAction({runtime,
    session:{run:()=>{calls++; return run();}}, taskId:'A',
    getCurrentRevision:()=>revision,advanceRevision:()=>{revision=`r${++rev}`;}});
  return {runtime,editing,action,setRun:x=>{run=x;},
    get rev(){return rev;},get calls(){return calls;}};
}

test('S95i requires semantic-only DocumentRuntime and task identity',()=>{
  assert.throws(()=>createFormulaEditingSession(),/S95I_EDITING_SESSION_CONTRACT/);
  assert.throws(()=>createFormulaEditingSession({runtime:DocumentRuntime.createSemantic('x'),taskId:''}),/S95I_EDITING_SESSION_CONTRACT/);
  assert.throws(()=>createFormulaEditingSession({runtime:{engine:{},getBlock(){return null;}},taskId:'A'}),/S95I_EDITING_SESSION_CONTRACT/);
});
test('S95i editor reads model-owned block ID, never allocates from DOM or count',()=>{
  const s=make();
  const snap=s.editing.begin('result');
  assert.deepEqual(snap,{blockId:'result',taskId:'A',source:'a+1',pending:false});
  assert.ok(Object.isFrozen(snap));
  assert.throws(()=>s.editing.begin('a'),/S95I_DRAFT_ALREADY_ACTIVE/);
  assert.equal(s.runtime.getBlock('result').source,'a+1');
});
test('S95i rejects other tasks, text, unknown IDs before opening draft',()=>{
  const s=make();
  for(const id of ['other','text','missing','']) assert.throws(()=>s.editing.begin(id),/S95I_/);
  assert.equal(s.editing.snapshot(),null);
});
test('S95i typing incomplete text never mutates source, dependency or calculation state',()=>{
  const s=make(), block=s.runtime.getBlock('a');
  const initial=structuredClone(block.calculation), oldAnalysis=s.runtime.dependencyAnalysis;
  s.editing.begin('a');s.editing.replaceSource('a:=');
  assert.equal(s.editing.snapshot().source,'a:=');
  assert.equal(block.source,'a:=2');
  assert.deepEqual(block.calculation,initial);
  assert.equal(s.runtime.dependencyAnalysis,oldAnalysis);
});
test('S95i cancel discards only local buffer, even after invalid partial input',()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('(');s.editing.cancel();
  assert.equal(s.runtime.getBlock('a').source,'a:=2');
  assert.equal(s.editing.snapshot(),null);
  assert.throws(()=>s.editing.prepareCommit(),/S95I_NO_ACTIVE_DRAFT/);
  assert.equal(s.rev,0);
});
test('S95i rejects non-string replacement and double submissions',()=>{
  const s=make();s.editing.begin('a');
  assert.throws(()=>s.editing.replaceSource(null),/S95I_SOURCE_INVALID/);
  const p=s.editing.prepareCommit();
  assert.deepEqual(p,{blockId:'a',source:'a:=2'});
  assert.ok(Object.isFrozen(p));
  assert.throws(()=>s.editing.replaceSource('a:=3'),/S95I_COMMIT_PENDING/);
  assert.throws(()=>s.editing.prepareCommit(),/S95I_COMMIT_PENDING/);
  assert.throws(()=>s.editing.cancel(),/S95I_COMMIT_PENDING/);
});
test('S95i prepared draft through existing S95e action performs one authoritative commit',async()=>{
  const s=make(),a=s.runtime.getBlock('a');
  s.editing.begin('a');s.editing.replaceSource('a:=5');
  const proposal=s.editing.prepareCommit();
  assert.equal(a.source,'a:=2');
  await s.action.calculate([proposal]);
  assert.equal(a.source,'a:=5');assert.equal(s.rev,1);assert.equal(s.calls,1);
  s.editing.finishCommit();assert.equal(s.editing.snapshot(),null);
});
test('S95i incomplete formula can commit as source without syntactic prescreening',async()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('f(');
  await s.action.calculate([s.editing.prepareCommit()]);s.editing.finishCommit();
  assert.equal(s.runtime.getBlock('a').source,'f(');
});
test('S95i refuses stale edits after another source commit without changing either source',()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('a:=3');
  s.runtime.setBlockSource('a','a:=99');
  assert.throws(()=>s.editing.prepareCommit(),/S95I_EDIT_CONFLICT/);
  assert.equal(s.runtime.getBlock('a').source,'a:=99');assert.equal(s.rev,0);
});
test('S95i detects ABA source changes via document generation',()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('a:=4');
  s.runtime.setBlockSource('a','a:=7');s.runtime.setBlockSource('a','a:=2');
  assert.throws(()=>s.editing.prepareCommit(),/S95I_EDIT_CONFLICT/);
});
test('S95i old draft cannot target block removed and reinserted with identical id',()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('a:=5');
  s.runtime.removeBlock('a');s.runtime.insertBlock({id:'a',type:'formula',taskId:'A',source:'a:=2'},0);
  assert.throws(()=>s.editing.prepareCommit(),/S95I_BLOCK_IDENTITY_STALE/);
});
test('S95i task boundary still enforced if same block object task membership changes',()=>{
  const s=make();s.editing.begin('a');s.runtime.getBlock('a').taskId='B';
  assert.throws(()=>s.editing.prepareCommit(),/S95I_BLOCK_IDENTITY_STALE/);
});
test('S95i move preserves object identity when unaffected formula source remains valid',()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('a:=5');
  s.runtime.moveBlock('a',1);
  assert.deepEqual(s.editing.prepareCommit(),{blockId:'a',source:'a:=5'});
});
test('S95i cannot finish until the existing action has actually committed source',()=>{
  const s=make();s.editing.begin('a');s.editing.replaceSource('a:=5');s.editing.prepareCommit();
  assert.throws(()=>s.editing.finishCommit(),/S95I_COMMIT_NOT_APPLIED/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');
  s.editing.retryDraft();assert.equal(s.editing.snapshot().pending,false);
});
test('S95i failed evaluation after authoritative source commit can still finish editing',async()=>{
  const s=make();s.setRun(async()=>{throw new Error('WORKER_TIMEOUT');});
  s.editing.begin('a');s.editing.replaceSource('a:=12');
  await assert.rejects(s.action.calculate([s.editing.prepareCommit()]),/WORKER_TIMEOUT/);
  assert.equal(s.runtime.getBlock('a').source,'a:=12');
  assert.throws(()=>s.editing.retryDraft(),/S95I_EDIT_CONFLICT/);
  s.editing.finishCommit();assert.equal(s.editing.snapshot(),null);
});
test('S95i asynchronous calculator cannot be submitted twice with editor draft',async()=>{
  const s=make();let release;
  s.setRun(()=>new Promise(resolve=>{release=resolve;}));
  s.editing.begin('a');s.editing.replaceSource('a:=5');
  const calculation=s.action.calculate([s.editing.prepareCommit()]);
  assert.throws(()=>s.editing.prepareCommit(),/S95I_COMMIT_PENDING/);
  release({kind:'complete'});await calculation;s.editing.finishCommit();
  assert.equal(s.runtime.getBlock('a').source,'a:=5');
});
