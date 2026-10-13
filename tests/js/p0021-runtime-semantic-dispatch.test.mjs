import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {expression} from '../../src/js/values/value.js';

const integer = n => expression({op:'integer', value:String(n)});
function runtime() {
  let oldCalls=0;
  const d=new DocumentRuntime({async calculate(){oldCalls++;throw Error('legacy route invoked');}},'doc');
  const add=(id,source,taskId='default')=>d.addBlock({id,type:'formula',source,taskId});
  return {d,add,get oldCalls(){return oldCalls;}};
}
const good = (blockId,n) => ({blockId,status:'success',value:integer(n)});

test('S47: DocumentRuntime creates ordered P0021 requests from owned source and provider IDs',()=>{
  const {d,add}=runtime();add('x','x:=12');add('f','f(t):=t^3+4t');add('call','f(x)');
  const batch=d.prepareSemanticTaskBatch();
  assert.deepEqual(batch.tasks.map(t=>t.blockId),['x','f','call']);
  assert.deepEqual(batch.tasks[2].providers.map(p=>[p.name,p.providerId]).sort(),[['f','f'],['x','x']]);
  assert.deepEqual([...batch.tasks[2].upstream].sort(),['f','x']);
});

test('S47: sparse recomputation requires explicitly cached providers',()=>{
  const {d,add}=runtime();add('x','x:=12');add('f','f(t):=t^3+4t');add('call','f(x)');
  assert.throws(()=>d.prepareSemanticTaskBatch('default',{recompute:new Set(['call'])}),/upstream/);
  const batch=d.prepareSemanticTaskBatch('default',{recompute:new Set(['call']),cachedIds:['x','f']});
  assert.deepEqual(batch.tasks.map(t=>t.blockId),['call']);
  assert.deepEqual(batch.tasks[0].providers.map(p=>p.providerId).sort(),['f','x']);
});

test('S47: dispatcher executes owned task requests without invoking CASEngine',async()=>{
  const env=runtime();const {d,add}=env;add('a','2');add('b','3');
  let calls=0;
  const result=await d.dispatchSemanticTask('default',{
    revision:'rev1',getCurrentRevision:()=> 'rev1',
    evaluate:async task=>{calls++;return good(task.blockId,task.blockId==='a'?2:3);},
  });
  assert.equal(result.kind,'complete');assert.equal(calls,2);assert.equal(env.oldCalls,0);
  assert.deepEqual(result.state.outcomes.map(o=>o.value.data.expr.value),['2','3']);
  assert.equal(d.getBlock('a').calculation.status,'idle'); // no premature result state commit
});

test('S47: stale revision stops dispatch before evaluating',async()=>{
  const {d,add}=runtime();add('a','2');let calls=0;
  const result=await d.dispatchSemanticTask('default',{
    revision:'rev1',getCurrentRevision:()=> 'rev2',
    evaluate:async task=>{calls++;return good(task.blockId,2);},
  });
  assert.equal(result.kind,'stale');assert.equal(calls,0);
});

test('S47: revision change during awaited evaluation cannot commit its outcome',async()=>{
  const {d,add}=runtime();add('a','2');add('b','3');let current='rev1',calls=0;
  const result=await d.dispatchSemanticTask('default',{
    revision:'rev1',getCurrentRevision:()=>current,
    evaluate:async task=>{calls++;current='rev2';return good(task.blockId,2);},
  });
  assert.equal(result.kind,'stale');assert.equal(result.state.outcomes.length,0);assert.equal(calls,1);
});

test('S47: no cross-task callable binding and no inferred cached result',()=>{
  const {d,add}=runtime();add('f','f(t):=t^2','one');add('call','f(3)','two');
  const batch=d.prepareSemanticTaskBatch('two');
  assert.deepEqual(batch.tasks[0].providers,[]);
  assert.throws(()=>d.prepareSemanticTaskBatch('two',{recompute:new Set(['f'])}),/current task/);
});

test('S47: malformed cache claims are rejected and stale cached revisions do not count',async()=>{
  const {d,add}=runtime();add('x','x:=12');add('call','x+1');
  assert.throws(()=>d.prepareSemanticTaskBatch('default',{recompute:new Set(['call']),cachedIds:['call']}),/cachedIds/);
  const result=await d.dispatchSemanticTask('default',{
    recompute:new Set(['call']),cachedIds:['x'],revision:'rev2',getCurrentRevision:()=> 'rev2',
    cachedOutcomes:new Map([['x',{revision:'rev1',outcome:good('x',12)}]]),
    evaluate:async()=>{throw Error('must not evaluate');},
  });
  assert.equal(result.kind,'missing-upstream');assert.equal(result.providerId,'x');
});
