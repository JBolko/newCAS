/**
 * S96a.1: targeted GREEN regressions for the semantic-only runtime.
 * No test hooks added to the production runtime, no legacy engine or Worker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';

function make() {
  const runtime=DocumentRuntime.createSemantic('s96a1');
  runtime.addBlock({id:'a',type:'formula',taskId:'T',source:'a:=2'});
  runtime.addBlock({id:'r',type:'formula',taskId:'T',source:'a+1'});
  return runtime;
}

test('S96a.1: semantic source keeps live S95i editing identity for unchanged editor contract',()=>{
  const runtime=make();
  const original=runtime.getBlock('a');
  const editing=createFormulaEditingSession({runtime,taskId:'T'});
  editing.begin('a');editing.replaceSource('a:=3');
  editing.prepareCommit();
  runtime.setBlockSource('a','a:=3');
  assert.equal(runtime.getBlock('a'),original);
  editing.finishCommit();
  assert.equal(editing.snapshot(),null);
});

test('S96a.1: observer exception after a successful source commit cannot veto it',()=>{
  const runtime=make();
  const original=runtime.getBlock('a');
  const notified=[];
  runtime.subscribeSemanticChanges(()=>{throw new Error('observer');});
  runtime.subscribeSemanticChanges(tasks=>notified.push(tasks));
  assert.doesNotThrow(()=>runtime.setBlockSource('a','a:=9'));
  assert.equal(runtime.getBlock('a'),original);
  assert.equal(runtime.getBlock('a').source,'a:=9');
  assert.deepEqual(notified,[['T']]);
});

test('S96a.1: nested source/structure/prepare mutations rejected during S95n publication',()=>{
  const runtime=make();
  const attempts=[
    ()=>runtime.setBlockSource('r','a+2'),
    ()=>runtime.insertBlock({id:'z',type:'formula',taskId:'T',source:'z:=4'},0),
    ()=>runtime.removeBlock('r'),
    ()=>runtime.moveBlock('r',0),
    ()=>runtime.addBlock({id:'y',type:'formula',taskId:'T',source:'y:=2'}),
    ()=>runtime.prepareDocumentTransaction([{kind:'source',blockId:'r',source:'a+2'}]),
  ];
  let i=0;
  runtime.subscribeSemanticChanges(()=>attempts[i++]());
  for(let n=0;n<attempts.length;n++) {
    const plan=runtime.prepareDocumentTransaction([{kind:'source',blockId:'a',source:`a:=${n+3}`}]);
    const outcome=runtime.applyDocumentTransaction(plan);
    assert.equal(outcome.notificationErrors,1);
    assert.equal(runtime.getBlock('r').source,'a+1');
    assert.equal(runtime.getBlock('z'),null);
    assert.equal(runtime.getBlock('y'),null);
  }
  assert.equal(i,attempts.length);
});

test('S96a.1: rollback releases guard, so next valid source edit succeeds',()=>{
  const runtime=make();
  const original=runtime.deriveSemanticTask;
  let calls=0;
  runtime.deriveSemanticTask=function(...args){
    if(++calls===2)throw new Error('INJECTED');
    return original.apply(this,args);
  };
  assert.throws(()=>runtime.setBlockSource('a','a:=8'),/INJECTED/);
  runtime.deriveSemanticTask=original;
  assert.equal(runtime.getBlock('a').source,'a:=2');
  assert.doesNotThrow(()=>runtime.setBlockSource('a','a:=8'));
  assert.equal(runtime.getBlock('a').source,'a:=8');
});
