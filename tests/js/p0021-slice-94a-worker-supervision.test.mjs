/** S94a: opt-in, fail-stop Worker client supervision. Does not implement evaluator semantics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerEvaluationClient, PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {expression} from '../../src/js/values/value.js';

const envelope = () => ({protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b1',taskScopeId:'t1',source:'2+3',providers:[]});
const selection = () => ({revision:'r1',blockId:'b1',taskScopeId:'t1',source:'2+3',evaluationRequest:{evaluatorId:'add'},operationSpec:{evaluatorId:'add'}});
const good = request => ({protocol:PROTOCOL,kind:'result',requestId:request.requestId,revision:'r1',blockId:'b1',outcome:{blockId:'b1',status:'success',value:expression({op:'integer',value:'5'})}});
function harness({timeoutMs=1000,maxPending=2,throwsOnSend=false}={}) {
 const listeners = new Map(); const sent=[]; let terminated=0, revision='r1';
 const worker={
  postMessage(msg){if (throwsOnSend) throw new Error('CLONE_FAILED'); sent.push(msg);},
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  terminate(){terminated++;},
 };
 const deliver=(type,data)=>{for(const fn of [...(listeners.get(type)??[])])fn(type==='message'?{data}:{});};
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:{timeoutMs,maxPending}});
 return {worker,client,sent,deliver,listenerCount:t=>listeners.get(t)?.size??0,terminated:()=>terminated,revision:r=>{revision=r;}};
}

test('S94a: completed result rehydrates P0005 Value and clears deadline',async()=>{
 const h=harness({timeoutMs:75});
 const p=h.client.evaluate(envelope(),selection());h.deliver('message',good(h.sent[0]));
 const result=await p;assert.equal(result.value.data.expr.value,'5');
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(h.terminated(),0,'settled request must not terminate a healthy Worker later');
 h.client.close();assert.equal(h.terminated(),1);
});
test('S94a: timed-out synchronous Worker is terminated; all pending reject with stable code',async()=>{
 const h=harness({timeoutMs:20,maxPending:3});
 const first=h.client.evaluate(envelope(),selection());const second=h.client.evaluate(envelope(),selection());
 const outcomes=await Promise.allSettled([first,second]);
 assert.equal(outcomes.length,2);
 for(const outcome of outcomes){assert.equal(outcome.status,'rejected');assert.match(outcome.reason.message,/^WORKER_TIMEOUT$/);}
 assert.equal(h.terminated(),1);
 assert.equal(h.listenerCount('message'),0);assert.equal(h.listenerCount('error'),0);assert.equal(h.listenerCount('messageerror'),0);
 await assert.rejects(h.client.evaluate(envelope(),selection()),/^Error: WORKER_TIMEOUT$/);
 h.deliver('message',good(h.sent[0]));assert.equal(h.terminated(),1,'late results cannot reopen closed client');
});
for(const [event,expected] of [['error','WORKER_CRASH'],['messageerror','WORKER_MESSAGE_ERROR']]) {
 test(`S94a: ${event} event closes Worker, rejects pending and prevents redispatch`,async()=>{
  const h=harness();const p=h.client.evaluate(envelope(),selection());
  h.deliver(event);await assert.rejects(p,new RegExp(expected));
  assert.equal(h.terminated(),1);assert.equal(h.listenerCount('message'),0);
  await assert.rejects(h.client.evaluate(envelope(),selection()),new RegExp(expected));
  assert.equal(h.sent.length,1);
 });
}
test('S94a: pending request limit rejects additional dispatch without killing healthy Worker',async()=>{
 const h=harness({maxPending:1});const first=h.client.evaluate(envelope(),selection());
 await assert.rejects(h.client.evaluate(envelope(),selection()),/WORKER_PENDING_LIMIT/);
 assert.equal(h.sent.length,1);assert.equal(h.terminated(),0);
 h.deliver('message',good(h.sent[0]));await first;
 const second=h.client.evaluate(envelope(),selection());assert.equal(h.sent.length,2);
 h.deliver('message',good(h.sent[1]));await second;h.client.close();
});
test('S94a: close is idempotent, terminates owned Worker and clears all listeners/timers',async()=>{
 const h=harness();const p=h.client.evaluate(envelope(),selection());
 h.client.close();h.client.close();
 await assert.rejects(p,/WORKER_CLIENT_CLOSED/);assert.equal(h.terminated(),1);
 for(const type of ['message','error','messageerror']) assert.equal(h.listenerCount(type),0);
 await assert.rejects(h.client.evaluate(envelope(),selection()),/WORKER_CLIENT_CLOSED/);
});
test('S94a: stale revision is rejected before Worker dispatch, still supervised',async()=>{
 const h=harness();h.revision('r2');
 await assert.rejects(h.client.evaluate(envelope(),selection()),/STALE_REVISION/);
 assert.equal(h.sent.length,0);h.client.close();
});
test('S94a: rejected postMessage releases pending capacity and deadline without terminating Worker',async()=>{
 const h=harness({throwsOnSend:true,timeoutMs:25,maxPending:1});
 await assert.rejects(h.client.evaluate(envelope(),selection()),/CLONE_FAILED/);
 await assert.rejects(h.client.evaluate(envelope(),selection()),/CLONE_FAILED/);
 await new Promise(resolve=>setTimeout(resolve,40));assert.equal(h.terminated(),0);
 h.client.close();
});
test('S94a: invalid supervision and nonterminable Workers rejected before listeners are attached',()=>{
 const worker={postMessage(){},addEventListener(){},removeEventListener(){}};
 for(const invalid of [{timeoutMs:0,maxPending:1},{timeoutMs:1.5,maxPending:1},
                        {timeoutMs:2147483648,maxPending:1},{timeoutMs:1,maxPending:0},
                        {timeoutMs:1,maxPending:1,magic:true},{timeoutMs:1}]) {
  assert.throws(()=>createWorkerEvaluationClient({worker:{...worker,terminate(){}},getCurrentRevision:()=> 'r1',supervision:invalid}),/supervision requires/);
 }
 assert.throws(()=>createWorkerEvaluationClient({worker,getCurrentRevision:()=> 'r1',supervision:{timeoutMs:100,maxPending:1}}),/terminable Worker/);
});
test('S94a: default unsupervised clients preserve legacy close behavior (no Worker termination)',async()=>{
 let terminations=0;const listeners=new Map();const sent=[];
 const worker={postMessage:m=>sent.push(m),addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t),terminate:()=>terminations++};
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=> 'r1'});
 const p=client.evaluate(envelope(),selection());listeners.get('message')({data:good(sent[0])});await p;
 client.close();assert.equal(terminations,0);assert.equal(listeners.size,0);
});
