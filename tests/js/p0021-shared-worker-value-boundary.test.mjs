import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerEvaluationClient,PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {expression,isValue} from '../../src/js/values/value.js';
import {binderIdentity} from '../../src/js/semantics/identity.js';
const rev='r1';
const envelope={protocol:'newcas.semantic-evaluation.v1',revision:rev,blockId:'b',taskScopeId:'s',source:'diff',providers:[]};
const selection={revision:rev,blockId:'b',taskScopeId:'s',source:'diff',evaluationRequest:{evaluatorId:'diff'},operationSpec:{evaluatorId:'diff'}};
function fakeClient(){
 const listeners=new Set();let last;
 const worker={postMessage:msg=>last=msg,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>rev});
 const dispatch=outcome=>{const msg={protocol:PROTOCOL,kind:'result',requestId:last.requestId,revision:rev,blockId:'b',outcome};for(const fn of listeners)fn({data:structuredClone(msg)});};
 return {client,dispatch};
}
const outcome=value=>({blockId:'b',status:'success',value});
const n=x=>expression({op:'integer',value:String(x)});
const symbol=()=>expression({op:'symbolRef',identity:binderIdentity('s38:binder','x')});
for (const [name,value] of [['scalar',n(5)],['symbolic',symbol()]]) {
 test(`S38 ${name} success is a valid frozen P0005 Value after Worker clone`,async()=>{
  const h=fakeClient();const wait=h.client.evaluate(envelope,selection);h.dispatch(outcome(value));const result=await wait;
  assert.equal(isValue(result.value),true);assert.equal(Object.isFrozen(result.value),true);
  if(name==='symbolic')assert.equal(Object.isFrozen(result.value.data.expr.identity),true);
  h.client.close();
 });
}
test('S38 invalid successful Value fails closed',async()=>{
 const h=fakeClient();const wait=h.client.evaluate(envelope,selection);h.dispatch(outcome({kind:'expression',data:{expr:{op:'unknown'}}}));await assert.rejects(wait,/INVALID_WORKER_VALUE/);h.client.close();
});
test('S38 success without Value fails closed',async()=>{
 const h=fakeClient();const wait=h.client.evaluate(envelope,selection);h.dispatch({blockId:'b',status:'success'});await assert.rejects(wait,/INVALID_WORKER_VALUE/);h.client.close();
});
test('S38 worker failure remains failure and retains its code',async()=>{
 const h=fakeClient();const wait=h.client.evaluate(envelope,selection);h.dispatch({blockId:'b',status:'failure',code:'MATH_ERROR',message:'not defined'});const result=await wait;assert.equal(result.code,'MATH_ERROR');assert.equal(result.status,'failure');h.client.close();
});
test('S38 stale revision still takes precedence over Value decoding',async()=>{
 let current='r1';const listeners=new Set();let req;
 const worker={postMessage:x=>req=x,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>current});const waiting=client.evaluate(envelope,selection);current='r2';for(const fn of listeners)fn({data:{protocol:PROTOCOL,kind:'result',requestId:req.requestId,revision:'r1',blockId:'b',outcome:outcome({broken:true})}});await assert.rejects(waiting,/STALE_REVISION/);client.close();
});
