import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchSemanticEvaluationBatch as dispatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
const task=(blockId,upstream=[],providers=[])=>Object.freeze({blockId, upstream, providers, source:`${blockId} := 1`,taskScopeId:'T'});
const batch=(...tasks)=>({tasks,cycles:[],blocked:[]});
const opts=(evaluate, extra={})=>({revision:'r1',getCurrentRevision:()=> 'r1',evaluate,...extra});
const success=blockId=>({blockId,status:'success',value:{kind:'IntegerValue',value:3}});

test('P0021 S6 dispatches in sequence and forwards exact tasks/provider IDs',async()=>{
 const first=task('a');const second=task('b',['a'],[{name:'a',providerId:'a'}]);
 const seen=[];
 const result=await dispatch(batch(first,second),opts(async t=>{seen.push(t);return success(t.blockId)}));
 assert.equal(result.kind,'complete'); assert.deepEqual(seen,[first,second]);assert.equal(result.state.cursor,2);
});
test('P0021 S6 does not dispatch dependents of failed values',async()=>{
 const seen=[];const result=await dispatch(batch(task('a'),task('b',['a'])),opts(async t=>{
  seen.push(t.blockId);return {blockId:'a',status:'failure',code:'MATH_ERROR',message:'division by zero'};
 }));
 assert.deepEqual(seen,['a']); assert.equal(result.kind,'complete');
 assert.equal(result.state.outcomes[1].code,'UPSTREAM_FAILED');
});
test('P0021 S6 transitive failure propagates without running dependent evaluator',async()=>{
 const result=await dispatch(batch(task('a'),task('b',['a']),task('c',['b'])),opts(async()=>({blockId:'a',status:'failure',code:'ERROR',message:'oops'})));
 assert.deepEqual(result.state.outcomes.map(x=>x.code),['ERROR','UPSTREAM_FAILED','UPSTREAM_FAILED']);
});
test('P0021 S6 ignores late result after revision change',async()=>{
 let rev='r1';let release;const gate=new Promise(resolve=>release=resolve);
 const p=dispatch(batch(task('a'),task('b',['a'])),{revision:'r1',getCurrentRevision:()=>rev,evaluate:async()=>{await gate;return success('a')}});
 await Promise.resolve();rev='r2';release();const out=await p;
 assert.equal(out.kind,'stale');assert.equal(out.state.cursor,0);
});
test('P0021 S6 refuses dispatch of already stale batch',async()=>{
 let called=0;const out=await dispatch(batch(task('a')),{revision:'r1',getCurrentRevision:()=> 'r2',evaluate:async()=>{called++;return success('a')}});
 assert.equal(out.kind,'stale');assert.equal(called,0);
});
test('P0021 S6 normalizes evaluator exceptions as failures and blocks dependents',async()=>{
 const out=await dispatch(batch(task('a'),task('b',['a'])),opts(async()=>{throw new Error('backend down')}));
 assert.equal(out.kind,'complete');assert.equal(out.state.outcomes[0].code,'EVALUATOR_ERROR');
 assert.equal(out.state.outcomes[1].code,'UPSTREAM_FAILED');
});
test('P0021 S6 reports missing prior outcome and does not evaluate',async()=>{
 let called=0;const out=await dispatch(batch(task('b',['a'])),opts(async()=>{called++;return success('b')}));
 assert.equal(out.kind,'missing-upstream');assert.equal(out.providerId,'a');assert.equal(called,0);
});
test('P0021 S6 accepts revision-matched cached upstream only',async()=>{
 const cache=new Map([['a',{revision:'r1',outcome:success('a')}]]);
 const out=await dispatch(batch(task('b',['a'])),opts(async t=>success(t.blockId),{cachedOutcomes:cache}));
 assert.equal(out.kind,'complete');assert.equal(out.state.cursor,1);
 const old=await dispatch(batch(task('b',['a'])),opts(async t=>success(t.blockId),{cachedOutcomes:new Map([['a',{revision:'old',outcome:success('a')}]])}));
 assert.equal(old.kind,'missing-upstream');
});
test('P0021 S6 rejects malformed evaluator output, never commits it',async()=>{
 await assert.rejects(dispatch(batch(task('a')),opts(async()=>({blockId:'a',status:'success',value:undefined}))),/invalid or out-of-order outcome/);
});
test('P0021 S6 empty batch completes without backend invocation',async()=>{
 const out=await dispatch(batch(),opts(async()=>{throw Error('must not be called')}));
 assert.equal(out.kind,'complete');assert.equal(out.state.cursor,0);
});
test('P0021 S6 checks required boundary functions',async()=>{
 await assert.rejects(dispatch(batch(task('a')),{revision:'r1',getCurrentRevision:()=> 'r1'}),TypeError);
});
