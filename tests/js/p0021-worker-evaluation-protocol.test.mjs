import {expression} from '../../src/js/values/value.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerEvaluationClient,createWorkerEvaluationHandler,PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const envelope = () => ({protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b1',taskScopeId:'t1',source:'2+3',providers:[]});
const selection = () => ({revision:'r1',blockId:'b1',taskScopeId:'t1',source:'2+3',evaluationRequest:{evaluatorId:'add'},operationSpec:{evaluatorId:'add'}});
function harness(evaluateSelected = async e => ({blockId:e.blockId,status:'success',value:expression({op:'integer',value:'5'})})) {
  const listeners=new Set(); const sent=[]; let revision='r1';
  const worker={postMessage:message=>{sent.push(message); queueMicrotask(()=>handler({data:message}));},addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
  const handler=createWorkerEvaluationHandler({evaluateSelected,postMessage:msg=>{for(const fn of listeners) fn({data:msg});}});
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision});
  return {client,sent,setRevision:v=>revision=v,deliver:msg=>{for(const fn of listeners)fn({data:msg});},listeners};
}
test('selected evaluation crosses message boundary',async()=>{const h=harness();assert.equal((await h.client.evaluate(envelope(),selection())).value.data.expr.value,'5');h.client.close();});
test('request IDs are unique',async()=>{const h=harness();await Promise.all([h.client.evaluate(envelope(),selection()),h.client.evaluate(envelope(),selection())]);assert.notEqual(h.sent[0].requestId,h.sent[1].requestId);h.client.close();});
test('stale revision before dispatch is rejected',async()=>{const h=harness();h.setRevision('r2');await assert.rejects(h.client.evaluate(envelope(),selection()),/STALE_REVISION/);assert.equal(h.sent.length,0);h.client.close();});
test('revision change while executing discards reply',async()=>{let release;const h=harness(()=>new Promise(resolve=>{release=resolve}));const pending=h.client.evaluate(envelope(),selection());await new Promise(queueMicrotask);h.setRevision('r2');release({blockId:'b1',status:'success',value:5});await assert.rejects(pending,/STALE_REVISION/);h.client.close();});
test('mismatched selected source never reaches worker',()=>{const h=harness();const s=selection();s.source='wrong';assert.throws(()=>h.client.evaluate(envelope(),s),/mismatched/);h.client.close();});
test('mismatched returned block rejects',async()=>{const h=harness();const p=h.client.evaluate(envelope(),selection());h.deliver({protocol:PROTOCOL,kind:'result',requestId:'evaluation-1',revision:'r1',blockId:'wrong',outcome:{blockId:'wrong',status:'success',value:1}});await assert.rejects(p,/CORRELATION/);h.client.close();});
test('handler failure becomes explicit outcome',async()=>{const h=harness(async()=>{throw new Error('math exploded')});const result=await h.client.evaluate(envelope(),selection());assert.equal(result.status,'failure');assert.equal(result.code,'WORKER_EVALUATION_ERROR');h.client.close();});
test('close rejects pending and detaches listener',async()=>{const h=harness(()=>new Promise(()=>{}));const p=h.client.evaluate(envelope(),selection());h.client.close();await assert.rejects(p,/CLOSED/);assert.equal(h.listeners.size,0);});
test('rejected malformed worker payload is not evaluated',async()=>{let called=false;const messages=[];const handler=createWorkerEvaluationHandler({evaluateSelected:()=>{called=true;},postMessage:x=>messages.push(x)});await handler({data:{protocol:PROTOCOL,kind:'evaluate',requestId:'x',revision:'r1',blockId:'b1',envelope:envelope(),selection:{...selection(),revision:'r2'}}});assert.equal(called,false);assert.equal(messages[0].outcome.status,'failure');});
test('unrelated worker message does not affect pending evaluation',async()=>{const h=harness();const p=h.client.evaluate(envelope(),selection());h.deliver({kind:'noise'});assert.equal((await p).status,'success');h.client.close();});
