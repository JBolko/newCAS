/** Targeted review reinforcement: detached oracles and explicit fault timing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {expression} from '../../src/js/values/value.js';
import {seedSemanticTask,snapshotData} from '../helpers/runtime-fixtures.js';

const value=n=>expression({op:'integer',value:String(n)});
function setup() {
  const runtime=DocumentRuntime.createSemantic('s98c-regressions');
  for(const [id,source,taskId] of [
    ['a','a:=2','T'],['b','b:=a+1','T'],['c','c:=b+1','T'],['independent','k:=8','T'],
    ['ua','a:=4','U'],['ub','b:=a+1','U'],['ui','k:=9','U'],['z','a:=100','Z'],
  ])runtime.addBlock({id,type:'formula',source,taskId});
  let epoch=0;
  const history=createDocumentHistorySession({runtime,getCurrentRevision:()=>String(epoch),advanceRevision:()=>{epoch++;}});
  return {runtime,history,get epoch(){return epoch;}};
}
const state=rt=>snapshotData(rt.getBlocks().map(b=>({id:b.id,type:b.type,taskId:b.taskId,
  source:b.source,calculation:b.calculation,dependencies:b.dependencies})));
const graph=rt=>['T','U','Z'].map(task=>[task,rt.deriveSemanticTask(task).snapshot.blocks.map(b=>
  [b.blockId,[...rt.getDependencyGraph(task).getUpstream(b.blockId)]])]);
async function prime(rt) {for(const task of ['T','U','Z'])await seedSemanticTask(rt,task);}

test('transaction rollback restores retained slots after downstream really became dirty',async()=>{
  const s=setup(),rt=s.runtime;await prime(rt);
  const before=state(rt),beforeGraph=graph(rt),stamp=rt.getDocumentMutationIdentity(),history=s.history.snapshot();
  const view=rt.getBlock('b'),result=view.calculation.result,identity=rt.getBlockSourceIdentity('b');
  const original=rt.markBlockDirty;let injected=0,notices=0;
  rt.subscribeSemanticChanges(()=>notices++);
  rt.markBlockDirty=function(id){
    const returned=original.call(this,id);
    if(id==='b'){
      assert.equal(this.getBlock(id).calculation.status,'dirty','fault must happen after invalidation');
      assert.equal(this.getBlock(id).calculation.result,null);
      injected++;throw Error('S98C_AFTER_DIRTY');
    }
    return returned;
  };
  try{assert.throws(()=>s.history.execute([{kind:'source',blockId:'a',source:'a:=7'}]),/S98C_AFTER_DIRTY/);}
  finally{rt.markBlockDirty=original;}
  assert.equal(injected,1);assert.deepEqual(state(rt),before);assert.deepEqual(graph(rt),beforeGraph);
  assert.equal(rt.getBlock('b'),view);assert.equal(view.calculation.result,result);
  assert.equal(rt.getBlockSourceIdentity('b'),identity);assert.equal(rt.getDocumentMutationIdentity(),stamp);
  assert.deepEqual(s.history.snapshot(),history);assert.equal(s.epoch,1);assert.equal(notices,0);
  assert.equal(s.history.execute([{kind:'source',blockId:'a',source:'a:=8'}]).kind,'applied');
  assert.equal(s.history.undo().kind,'applied');
});

test('source publication refuses nested edits while permitting the outer accepted edit',async()=>{
  const s=setup(),rt=s.runtime;await prime(rt);
  const before=state(rt),outside=before.filter(b=>b.taskId!=='T');
  const attempts=[
    ()=>rt.setBlockSource('c','c:=99'),
    ()=>rt.insertBlock({id:'x',type:'formula',taskId:'T',source:'x:=7'},0),
    ()=>rt.removeBlock('c'),()=>rt.moveBlock('c',0),
    ()=>rt.prepareDocumentTransaction([{kind:'source',blockId:'c',source:'c:=99'}]),
  ];
  const errors=[];let notices=0;
  rt.subscribeSemanticChanges(()=>{
    notices++;
    if(notices!==1)return; // Bound a broken reentrancy implementation during mutation testing.
    for(const attempt of attempts){try{attempt();errors.push('accepted');}catch(e){errors.push(e.message);}}
  });
  rt.setBlockSource('a','a:=7');
  assert.equal(notices,1);assert.deepEqual(errors,attempts.map(()=> 'S96A_REENTRANT_MUTATION'));
  assert.equal(rt.getBlock('a').source,'a:=7');assert.equal(rt.getBlock('c').source,'c:=b+1');
  assert.deepEqual(rt.getBlocks().map(b=>b.id),before.map(b=>b.id));assert.equal(rt.getBlock('x'),null);
  assert.deepEqual(state(rt).filter(b=>b.taskId!=='T'),outside);
  // A new owner starts at the accepted source; no implicit recovery/reset.
  let epoch=0;
  const owner=createDocumentHistorySession({runtime:rt,getCurrentRevision:()=>String(epoch),advanceRevision:()=>{epoch++;}});
  owner.execute([{kind:'source',blockId:'a',source:'a:=8'}]);owner.undo();owner.redo();
  assert.equal(rt.getBlock('a').source,'a:=8');assert.equal(epoch,3);
});

for(const structural of [false,true])
test(`multi-task transaction has exact invalidation and one scope notification; structural=${structural}`,async()=>{
  const s=setup(),rt=s.runtime;await prime(rt);
  const before=state(rt),notifications=[];
  rt.subscribeSemanticChanges(scopes=>notifications.push([...scopes]));
  const operations=structural ? [{kind:'insert',blockId:'shadow',taskId:'T',source:'a:=9',index:1}]
    : [{kind:'source',blockId:'a',source:'a:=9'}];
  operations.push({kind:'source',blockId:'ua',source:'a:=7'});
  const outcome=rt.applyDocumentTransaction(rt.prepareDocumentTransaction(operations));
  const expected=structural?['shadow','b','c','ua','ub']:['a','b','c','ua','ub'];
  assert.deepEqual(new Set(outcome.affectedBlockIds),new Set(expected));
  assert.deepEqual(notifications,[['T','U']]);
  for(const old of before){
    const now=rt.getBlock(old.id);
    if(expected.includes(old.id)){
      assert.equal(now.calculation.generation,old.calculation.generation+1,old.id);
      assert.equal(now.calculation.result,null);assert.equal(now.calculation.error,null);
      assert.equal(now.calculation.status,['a','ua'].includes(old.id)?'idle':'dirty');
    }else assert.deepEqual(state(rt).find(b=>b.id===old.id),old,`unaffected ${old.id}`);
  }
});

for(const invalid of [null,17,{}, {kind:'expression',data:{}}])
test(`non-Value batch tail cannot partially publish earlier valid outcomes: ${JSON.stringify(invalid)}`,async()=>{
  const s=setup(),rt=s.runtime;await prime(rt);
  const before=state(rt),stamp=rt.getDocumentMutationIdentity(),history=s.history.snapshot();
  const calls=[];
  await assert.rejects(rt.evaluateAndCommitSemanticTask('T',{revision:'r',getCurrentRevision:()=> 'r',
    evaluate:async task=>{
      calls.push(task.blockId);
      return {blockId:task.blockId,status:'success',value:task.blockId==='independent'?invalid:value(999)};
    }}),/invalid semantic Value/);
  assert.equal(calls.length,4);assert.ok(calls.indexOf('a')<calls.indexOf('independent'));
  assert.deepEqual(state(rt),before,'all authoritative result slots remain the old successes');
  assert.equal(rt.getDocumentMutationIdentity(),stamp);assert.deepEqual(s.history.snapshot(),history);assert.equal(s.epoch,0);
});
