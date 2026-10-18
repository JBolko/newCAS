import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupervisedWorkerOwner} from '../../src/js/evaluation/create-supervised-worker-owner.js';
import {PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {expression} from '../../src/js/values/value.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';

const makeRequest=(revision='r1')=>({
  envelope:{protocol:'newcas.semantic-evaluation.v1',revision,blockId:'b1',taskScopeId:'t1',source:'2+3',providers:[]},
  selection:{revision,blockId:'b1',taskScopeId:'t1',source:'2+3',evaluationRequest:{},operationSpec:{}},
});
const success=request=>({protocol:PROTOCOL,kind:'result',requestId:request.requestId,
  revision:request.revision,blockId:request.blockId,outcome:{blockId:request.blockId,status:'success',
    value:expression({op:'integer',value:'5'})}});
function fixture(){
  const workers=[];let revision='r1';let creationError=null;
  function createWorker(){
    if(creationError){const error=creationError;creationError=null;throw error;}
    const listeners=new Map();const messages=[];let terminations=0;
    const worker={
      postMessage:m=>messages.push(m),
      addEventListener(t,f){if(!listeners.has(t)) listeners.set(t,new Set());listeners.get(t).add(f);},
      removeEventListener(t,f){listeners.get(t)?.delete(f);},
      terminate(){terminations++;},
      fire(t,payload){for(const f of [...(listeners.get(t)??[])])f(t==='message'?{data:payload}:{});},
      messages, get terminations(){return terminations;},
      listenerCount:t=>listeners.get(t)?.size??0,
    };
    workers.push(worker);return worker;
  }
  const owner=()=>createSupervisedWorkerOwner({createWorker,getCurrentRevision:()=>revision,
    supervision:{timeoutMs:1000,maxPending:2}});
  return {workers,owner,setRevision:x=>revision=x,failNext:x=>creationError=x,createWorker};
}
const evaluate=(owner,revision='r1')=>{const {envelope,selection}=makeRequest(revision);return owner.evaluate(envelope,selection);};

test('S94c initial client rehydrates Values using the unchanged S94a transport',async()=>{
  const h=fixture(),owner=h.owner(),w=h.workers[0];
  const pending=evaluate(owner);assert.equal(w.messages.length,1);
  w.fire('message',success(w.messages[0]));
  assert.equal((await pending).value.data.expr.value,'5');
  owner.close();assert.equal(w.terminations,1);
});

test('S94c explicit restart closes old Worker, rejects pending and NEVER replays',async()=>{
  const h=fixture(),owner=h.owner(),old=h.workers[0];
  const pending=evaluate(owner);
  owner.restart();assert.equal(h.workers.length,2);assert.equal(old.terminations,1);
  await assert.rejects(pending,/WORKER_CLIENT_CLOSED/);
  assert.equal(h.workers[1].messages.length,0);
  old.fire('message',success(old.messages[0]));
  const result=evaluate(owner);const next=h.workers[1];next.fire('message',success(next.messages[0]));
  assert.equal((await result).value.data.expr.value,'5');owner.close();
});

test('S94c resolved-before-restart microtask is rejected as stale generation',async()=>{
  const h=fixture(),owner=h.owner(),old=h.workers[0];
  const prior=evaluate(owner);
  old.fire('message',success(old.messages[0]));
  owner.restart();
  await assert.rejects(prior,/WORKER_GENERATION_STALE/);
  owner.close();
});

test('S94c explicit restart after Worker crash uses a fresh Worker',async()=>{
  const h=fixture(),owner=h.owner(),old=h.workers[0];
  const pending=evaluate(owner);old.fire('error');
  await assert.rejects(pending,/WORKER_CRASH/);assert.equal(old.terminations,1);
  await assert.rejects(evaluate(owner),/WORKER_CRASH/);
  owner.restart();const next=h.workers[1];
  const recovered=evaluate(owner);next.fire('message',success(next.messages[0]));
  assert.equal((await recovered).status,'success');owner.close();
});

test('S94c explicit restart after timeout never retries failed requests',async()=>{
  const h=fixture(),owner=createSupervisedWorkerOwner({createWorker:h.createWorker,
    getCurrentRevision:()=> 'r1',supervision:{timeoutMs:15,maxPending:2}});
  const old=h.workers[0];const pending=evaluate(owner);
  await assert.rejects(pending,/WORKER_TIMEOUT/);assert.equal(old.terminations,1);
  owner.restart();const next=h.workers[1];assert.equal(next.messages.length,0);
  const result=evaluate(owner);next.fire('message',success(next.messages[0]));await result;
  owner.close();
});

test('S94c failed Worker factory leaves no live client and allows a later explicit restart',async()=>{
  const h=fixture(),owner=h.owner(),old=h.workers[0];
  h.failNext(new Error('CANNOT_CREATE_WORKER'));
  assert.throws(()=>owner.restart(),/CANNOT_CREATE_WORKER/);
  assert.equal(old.terminations,1);
  await assert.rejects(evaluate(owner),/WORKER_OWNER_UNAVAILABLE/);
  owner.restart();assert.equal(h.workers.length,2);owner.close();
});

test('S94c failed client construction terminates the newly created Worker',()=>{
  let worker;
  assert.throws(()=>createSupervisedWorkerOwner({
    createWorker(){worker={postMessage(){},addEventListener(){},removeEventListener(){},
      terminations:0,terminate(){this.terminations++;}};return worker;},
    getCurrentRevision:()=> 'r1',supervision:{timeoutMs:0,maxPending:1},
  }),/supervision requires/);
  assert.equal(worker.terminations,1);
});

test('S94c close is permanent and idempotent, no resurrection',async()=>{
  const h=fixture(),owner=h.owner();owner.close();owner.close();
  assert.equal(h.workers[0].terminations,1);
  assert.throws(()=>owner.restart(),/WORKER_OWNER_CLOSED/);
  await assert.rejects(evaluate(owner),/WORKER_OWNER_CLOSED/);
  assert.equal(h.workers.length,1);
});

test('S94c new Worker respects the CURRENT document revision; old revision cannot dispatch',async()=>{
  const h=fixture(),owner=h.owner();h.setRevision('r2');owner.restart();
  await assert.rejects(evaluate(owner,'r1'),/STALE_REVISION/);
  assert.equal(h.workers[1].messages.length,0);
  const accepted=evaluate(owner,'r2');h.workers[1].fire('message',success(h.workers[1].messages[0]));
  assert.equal((await accepted).status,'success');owner.close();
});

test('S94c transport restart does not mutate authoritative DocumentRuntime sources/generations',async()=>{
  const runtime=new DocumentRuntime({calculate(){throw Error('legacy forbidden');}},'recovery-doc');
  runtime.addBlock({id:'b1',taskId:'t1',type:'formula',source:'x:=2'});
  const before=runtime.getBlock('b1');const generation=before.calculation.generation;
  const h=fixture(),owner=h.owner();const pending=evaluate(owner);
  owner.restart();await assert.rejects(pending,/WORKER_CLIENT_CLOSED/);
  assert.equal(runtime.getBlock('b1').source,'x:=2');
  assert.equal(runtime.getBlock('b1').calculation.generation,generation);
  assert.equal(runtime.getBlock('b1').calculation.status,'idle');
  owner.close();
});

test('S94c validates recovery owner input without allocating Worker',()=>{
  for(const opts of [{},{createWorker:()=>{},getCurrentRevision:()=> 'r1'},
    {createWorker:1,getCurrentRevision:()=> 'r1',supervision:{}}]){
    assert.throws(()=>createSupervisedWorkerOwner(opts),/required/);
  }
});
