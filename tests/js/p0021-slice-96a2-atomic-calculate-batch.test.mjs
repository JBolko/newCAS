/** S96a.2 selected atomic multi-draft calculate tests.
 * S95i's single-formula Enter identity contract remains unchanged until S96b.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';

function setup({beforeAdvance}={}) {
  const runtime=DocumentRuntime.createSemantic('s96a2');
  for (const [id,source] of [['a','a:=2'],['f','f(t):=t^2+a'],['r','f(3)']])
    runtime.addBlock({id,type:'formula',taskId:'T',source});
  runtime.addBlock({id:'foreign',type:'formula',taskId:'other',source:'z:=2'});
  let generation=0, runs=0;
  const action=createSemanticCalculateAction({runtime,taskId:'T',
    session:{run:async()=>{runs++;return {kind:'complete'};}},
    getCurrentRevision:()=>`r${generation}`,
    advanceRevision:()=>{beforeAdvance?.(runtime);generation++;},
  });
  return {runtime,action,get runs(){return runs;},get epoch(){return generation;}};
}
const proposal=()=>[{blockId:'a',source:'a:=5'},{blockId:'r',source:'f(4)'}];

test('S96a.2: multi-draft Calculate publishes ONE atomic transaction/notification',async()=>{
  const s=setup();let n=0,seen;
  s.runtime.subscribeSemanticChanges(()=>{
    n++;seen=[s.runtime.getBlock('a').source,s.runtime.getBlock('r').source];
    throw new Error('non-authoritative subscriber');
  });
  const out=await s.action.calculate(proposal());
  assert.equal(out.kind,'complete');
  assert.equal(n,1);assert.deepEqual(seen,['a:=5','f(4)']);
  assert.equal(s.epoch,1);assert.equal(s.runs,1);
});

test('S96a.2: failed semantic publication never partially commits two sources or invokes worker',async()=>{
  const s=setup(),old=s.runtime.getBlocks().map(b=>[b.id,b.source]);
  const previous=s.runtime.deriveSemanticTask;let calls=0;
  s.runtime.deriveSemanticTask=function(...args){
    if(++calls===2)throw new Error('S96A2_INJECTED_DERIVATION');
    return previous.apply(this,args);
  };
  let notifications=0;
  s.runtime.subscribeSemanticChanges(()=>notifications++);
  try {
    await assert.rejects(s.action.calculate(proposal()),/S96A2_INJECTED_DERIVATION/);
  } finally {s.runtime.deriveSemanticTask=previous;}
  assert.deepEqual(s.runtime.getBlocks().map(b=>[b.id,b.source]),old);
  assert.equal(notifications,0);assert.equal(s.runs,0);
  // Host revision may advance monotonically even if publication then fails.
  assert.equal(s.epoch,1);
});

test('S96a.2: a host-side mutation during epoch advance invalidates prepared batch plan',async()=>{
  const s=setup({beforeAdvance:runtime=>runtime.setBlockSource('f','f(t):=t^2+9')});
  await assert.rejects(s.action.calculate(proposal()),/S95N_STALE_PLAN/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');
  assert.equal(s.runtime.getBlock('r').source,'f(3)');
  assert.equal(s.runtime.getBlock('f').source,'f(t):=t^2+9');
  assert.equal(s.runs,0);
});

test('S96a.2: single-source calculate retains S95i EditingSession identity',async()=>{
  const s=setup();
  const editing=createFormulaEditingSession({runtime:s.runtime,taskId:'T'});
  const live=s.runtime.getBlock('r');
  editing.begin('r');editing.replaceSource('f(7)');
  const proposed=editing.prepareCommit();
  assert.equal((await s.action.calculate([proposed])).kind,'complete');
  editing.finishCommit();
  assert.equal(s.runtime.getBlock('r'),live);
  assert.equal(s.epoch,1);
});

test('S96a.2: changed multi-draft invalid tail is rejected before epoch and commit',async()=>{
  const s=setup();
  await assert.rejects(s.action.calculate([
    {blockId:'a',source:'a:=10'}, {blockId:'foreign',source:'z:=8'},
  ]),/S95E_BLOCK_NOT_IN_TASK/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');
  assert.equal(s.runtime.getBlock('foreign').source,'z:=2');
  assert.equal(s.runs,0);assert.equal(s.epoch,0);
});

test('S96a.2: unretired legacy Calculate keeps its preexisting multi-source route',async()=>{
  const runtime=new DocumentRuntime({},'s96a2-legacy');
  runtime.addBlock({id:'a',type:'formula',taskId:'T',source:'a:=2'});
  runtime.addBlock({id:'b',type:'formula',taskId:'T',source:'b:=3'});
  const a=runtime.getBlock('a'),b=runtime.getBlock('b');
  let notifications=0,epoch=0;
  runtime.subscribeSemanticChanges(()=>notifications++);
  const action=createSemanticCalculateAction({runtime,taskId:'T',
    session:{run:async()=>({kind:'complete'})},
    getCurrentRevision:()=>`r${epoch}`,advanceRevision:()=>{epoch++;}});
  await action.calculate([{blockId:'a',source:'a:=4'},{blockId:'b',source:'b:=9'}]);
  assert.equal(runtime.getBlock('a'),a);assert.equal(runtime.getBlock('b'),b);
  assert.equal(a.source,'a:=4');assert.equal(b.source,'b:=9');
  assert.equal(epoch,1);assert.equal(notifications,2);
});
