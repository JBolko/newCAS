import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {expression} from '../../src/js/values/value.js';

const value=n=>expression({op:'integer',value:String(n)});
function setup(...rows){
  let legacy=0;
  const runtime=new DocumentRuntime({calculate:async()=>{legacy++;throw Error('legacy invoked')}},'doc');
  for(const [id,source,taskId] of rows) runtime.addBlock({id,source,taskId:taskId??'default',type:'formula'});
  return {runtime,legacy:()=>legacy};
}
const good=(task,n)=>({blockId:task.blockId,status:'success',value:value(n)});
const options=(evaluate,other={})=>({revision:'r1',getCurrentRevision:()=> 'r1',evaluate,...other});

test('S48: successful semantic outcomes commit to existing runtime calculation slots',async()=>{
  const {runtime,legacy}=setup(['a','2'],['b','3']);
  const result=await runtime.evaluateAndCommitSemanticTask('default',options(t=>good(t,t.blockId==='a'?2:3)));
  assert.equal(result.kind,'complete');assert.equal(runtime.getBlock('a').calculation.result.data.expr.value,'2');
  assert.equal(runtime.getBlock('b').calculation.status,'success');assert.equal(legacy(),0);
});
test('S48: structured semantic failure clears old result and stores error',async()=>{
  const {runtime}=setup(['a','2']);
  await runtime.evaluateAndCommitSemanticTask('default',options(t=>good(t,2)));
  const result=await runtime.evaluateAndCommitSemanticTask('default',options(t=>({blockId:t.blockId,status:'failure',code:'INVALID_BINDING',message:'unresolved'})));
  assert.equal(result.kind,'complete');assert.equal(runtime.getBlock('a').calculation.status,'error');
  assert.equal(runtime.getBlock('a').calculation.result,null);assert.equal(runtime.getBlock('a').calculation.error.code,'INVALID_BINDING');
});
test('S48: source edit during pending evaluator cannot repopulate stale result',async()=>{
  const {runtime}=setup(['a','2']);let release;const pending=new Promise(resolve=>release=resolve);
  const run=runtime.evaluateAndCommitSemanticTask('default',options(async t=>{await pending;return good(t,2)}));
  await Promise.resolve();runtime.setBlockSource('a','3');release();
  assert.equal((await run).kind,'stale');assert.equal(runtime.getBlock('a').calculation.result,null);
});
test('S48: structural insertion during pending evaluator prevents a partial commit',async()=>{
  const {runtime}=setup(['a','2']);let release;const pending=new Promise(resolve=>release=resolve);
  const run=runtime.evaluateAndCommitSemanticTask('default',options(async t=>{await pending;return good(t,2)}));
  await Promise.resolve();runtime.insertBlock({id:'new',type:'formula',source:'8'},0);release();
  assert.equal((await run).kind,'stale');assert.equal(runtime.getBlock('a').calculation.result,null);
});
test('S48: external revision change rejects commit',async()=>{
  const {runtime}=setup(['a','2']);let current='r1';
  const result=await runtime.evaluateAndCommitSemanticTask('default',options(async t=>{current='r2';return good(t,2)},{getCurrentRevision:()=>current}));
  assert.equal(result.kind,'stale');assert.equal(runtime.getBlock('a').calculation.status,'idle');
});
test('S48: invalid successful Value causes no partial writes',async()=>{
  const {runtime}=setup(['a','2'],['b','3']);
  await assert.rejects(runtime.evaluateAndCommitSemanticTask('default',options(t=>t.blockId==='a'?good(t,2):({blockId:t.blockId,status:'success',value:{kind:'expression'}}))),/invalid semantic Value/);
  assert.equal(runtime.getBlock('a').calculation.status,'idle');assert.equal(runtime.getBlock('b').calculation.status,'idle');
});
test('S48: task isolation preserves unrelated task calculation state',async()=>{
  const {runtime}=setup(['a','2','one'],['b','3','two']);
  await runtime.evaluateAndCommitSemanticTask('one',options(t=>good(t,2)));
  assert.equal(runtime.getBlock('a').calculation.status,'success');assert.equal(runtime.getBlock('b').calculation.status,'idle');
});
