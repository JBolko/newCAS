import {seedSemanticTask} from '../helpers/runtime-fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {expression} from '../../src/js/values/value.js';

const value = n => expression({op:'integer',value:String(n)});
const runtimeWith = (...sources) => {
  const runtime = new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked')}}, 'doc');
  sources.forEach((source,i)=>runtime.addBlock({id:`b${i}`,source,taskId:'default',type:'formula'}));
  return runtime;
};
const request = (evaluate,getCurrentRevision=()=> 'r1') => ({revision:'r1',getCurrentRevision,evaluate});
const ok = task => ({blockId:task.blockId,status:'success',value:value(8)});

test('S49: external revision becomes stale: no evaluation restart, no commit',async()=>{
  const runtime=runtimeWith('8');let calls=0;let revision='r1';
  const result=await runtime.evaluateAndCommitSemanticTask('default',request(async task=>{
    calls++;revision='r2';return ok(task);
  },()=>revision));
  assert.equal(result.kind,'stale');assert.equal(calls,1);
  assert.equal(runtime.getBlock('b0').calculation.status,'idle');
  assert.equal(runtime.getBlock('b0').calculation.result,null);
});

test('S49: source mutation while awaiting evaluator is terminal for that invocation',async()=>{
  const runtime=runtimeWith('8');let calls=0;let release;
  const barrier=new Promise(resolve=>release=resolve);
  const run=runtime.evaluateAndCommitSemanticTask('default',request(async task=>{
    calls++;await barrier;return ok(task);
  }));
  await Promise.resolve();runtime.setBlockSource('b0','9');release();
  const result=await run;
  assert.equal(result.kind,'stale');assert.equal(calls,1);
  assert.equal(runtime.getBlock('b0').calculation.result,null);
});

test('S49: repeated dirty marking does not bump generation endlessly',async()=>{
  const runtime=runtimeWith('8');const block=runtime.getBlock('b0');
  await seedSemanticTask(runtime,'default',{generation:4,value:value(8)});
  runtime.markBlockDirty('b0');const generation=block.calculation.generation;
  assert.equal(generation,5);assert.equal(block.calculation.result,null);
  for(let i=0;i<100;i++) runtime.markBlockDirty('b0');
  assert.equal(block.calculation.generation,generation);
  assert.equal(block.calculation.status,'dirty');
});

test('S49: a fresh evaluation requires an explicit second invocation',async()=>{
  const runtime=runtimeWith('8');let revision='r1';let calls=0;
  const stale=await runtime.evaluateAndCommitSemanticTask('default',request(task=>{
    calls++;revision='r2';return ok(task);
  },()=>revision));
  assert.equal(stale.kind,'stale');assert.equal(calls,1);
  const fresh=await runtime.evaluateAndCommitSemanticTask('default',{
    revision:'r2',getCurrentRevision:()=>revision,evaluate:task=>{calls++;return ok(task);}
  });
  assert.equal(fresh.kind,'complete');assert.equal(calls,2);
  assert.equal(runtime.getBlock('b0').calculation.result.data.expr.value,'8');
});
