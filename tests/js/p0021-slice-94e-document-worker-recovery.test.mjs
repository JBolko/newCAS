/** S94e: real P0021 DocumentRuntime + selected evaluator + S94c owned Worker.
 * No Python double-running path, no autonomous scheduler, no legacy engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {parse} from '../../src/js/parser.mjs';
import {expression} from '../../src/js/values/value.js';
import {PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';

const integer = n => expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
function makeDoc(...source) {
  const doc=new DocumentRuntime({calculate(){throw Error('legacy engine must never run');}},'94e-doc');
  source.forEach(([id,value])=>doc.addBlock({id,type:'formula',source:value,taskId:'default'}));
  return doc;
}
function setup({source=[['a','a:=2+3']],timeoutMs=1000,brokenRevision=false}={}) {
  let counter=1;let revision='e1';const workers=[];
  const doc=makeDoc(...source);
  const createWorker=()=>{
    const listeners=new Map(),sent=[];
    let terminations=0;
    const w={
      sent,
      postMessage(m){sent.push(m);},
      addEventListener(k,cb){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(cb);},
      removeEventListener(k,cb){listeners.get(k)?.delete(cb);},
      fire(k,data){for(const fn of [...(listeners.get(k)??[])])fn(k==='message'?{data}:{});},
      terminate(){terminations++;},
      get terminations(){return terminations;},
    };workers.push(w);return w;
  };
  const session=createSupervisedSemanticTaskSession({runtime:doc,createWorker,
    getCurrentRevision:()=>revision,
    advanceRevision:()=>{if(!brokenRevision)revision=`e${++counter}`;return revision;},
    supervision:{timeoutMs,maxPending:2},
    createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
      createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,
        evaluate:evaluateSelected}),
  });
  return {doc,session,workers,get revision(){return revision;}};
}
async function nextSent(w,index=0) {
  for(let i=0;i<150;i++) {
    if(w.sent.length>index)return w.sent[index];
    await new Promise(resolve=>setImmediate(resolve));
  }
  throw new Error(`no Worker request ${index}`);
}
function reply(w,m,n){w.fire('message',{
  protocol:PROTOCOL,kind:'result',requestId:m.requestId,revision:m.revision,
  blockId:m.blockId,outcome:{blockId:m.blockId,status:'success',value:integer(n)},
});}
const val=(doc,id)=>doc.getBlock(id).calculation.result?.data?.expr?.value;

test('S94e accepts a successful selected P0021 batch using the supervised Worker',async()=>{
  const h=setup();const task=h.session.run(),w=h.workers[0];
  reply(w,await nextSent(w),5);
  assert.equal((await task).kind,'complete');
  assert.equal(val(h.doc,'a'),'5');
  h.session.close();assert.equal(w.terminations,1);
});

test('S94e explicit restart invalidates old batch, never replays; new batch explicitly succeeds',async()=>{
  const h=setup();const old=h.workers[0];const first=h.session.run();
  const prior=await nextSent(old);assert.equal(prior.blockId,'a');
  const generation=h.doc.getBlock('a').calculation.generation;
  assert.equal(h.session.restart(),'e2');
  assert.equal(h.workers.length,2);assert.equal(old.terminations,1);
  assert.equal(h.workers[1].sent.length,0); // NO implicit replay
  assert.equal((await first).kind,'stale');
  assert.equal(h.doc.getBlock('a').calculation.status,'idle');
  assert.equal(h.doc.getBlock('a').calculation.generation,generation);
  old.fire('message',{protocol:PROTOCOL,kind:'result',requestId:prior.requestId});
  const next=h.session.run(),fresh=h.workers[1];
  reply(fresh,await nextSent(fresh),5);
  assert.equal((await next).kind,'complete');assert.equal(val(h.doc,'a'),'5');
  h.session.close();
});

test('S94e settled transport result cannot commit after synchronous restart before microtask',async()=>{
  const h=setup();const task=h.session.run(),old=h.workers[0];
  const req=await nextSent(old);
  reply(old,req,5);
  h.session.restart();
  assert.equal((await task).kind,'stale');
  assert.equal(h.doc.getBlock('a').calculation.status,'idle');
  h.session.close();
});

test('S94e failed Worker leaves error diagnosis; retry after explicit restart recomputes ONLY failed dependent',async()=>{
  const h=setup({source:[['a','a:=2+3'],['b','b:=a+1']]});
  const first=h.session.run(),old=h.workers[0];
  reply(old,await nextSent(old),5);
  const secondReq=await nextSent(old,1);
  assert.equal(secondReq.blockId,'b');
  old.fire('error');
  assert.equal((await first).kind,'complete');
  assert.equal(val(h.doc,'a'),'5');assert.equal(h.doc.getBlock('b').calculation.status,'error');
  assert.equal(h.doc.getBlock('b').calculation.error.diagnostic.code,'WORKER_CRASH');
  h.session.restart();const current=h.workers[1];assert.equal(current.sent.length,0);
  const retry=h.session.run();
  const again=await nextSent(current);assert.equal(again.blockId,'b');
  assert.equal(current.sent.length,1);reply(current,again,6);
  assert.equal((await retry).kind,'complete');assert.equal(val(h.doc,'a'),'5');
  assert.equal(val(h.doc,'b'),'6');h.session.close();
});

test('S94e timeout produces a P0009 diagnostic and restart permits explicit retry',async()=>{
  const h=setup({timeoutMs:15});const old=h.workers[0];
  assert.equal((await h.session.run()).kind,'complete');
  assert.equal(h.doc.getBlock('a').calculation.error.diagnostic.code,'WORKER_TIMEOUT');
  assert.equal(old.terminations,1);h.session.restart();
  const again=h.session.run(),fresh=h.workers[1];reply(fresh,await nextSent(fresh),5);
  assert.equal((await again).kind,'complete');assert.equal(val(h.doc,'a'),'5');h.session.close();
});

test('S94e in-flight parallel run rejected; retry not duplicated and close revokes pending batch',async()=>{
  const h=setup();const pending=h.session.run(),w=h.workers[0];await nextSent(w);
  await assert.rejects(h.session.run(),/SEMANTIC_TASK_ALREADY_RUNNING/);
  assert.equal(w.sent.length,1);
  h.session.close();
  assert.equal((await pending).kind,'stale');
  assert.equal(h.doc.getBlock('a').calculation.status,'idle');
  assert.throws(()=>h.session.run(),/SEMANTIC_SESSION_CLOSED/);
});

test('S94e broken revision authority fails closed and invalidates via run lease',async()=>{
  const h=setup({brokenRevision:true});const old=h.workers[0];
  const pending=h.session.run();await nextSent(old);
  assert.throws(()=>h.session.restart(),/advanceRevision must synchronously change/);
  assert.equal(old.terminations,1);
  assert.equal((await pending).kind,'stale');
  assert.equal(h.doc.getBlock('a').calculation.status,'idle');
  assert.throws(()=>h.session.restart(),/SEMANTIC_SESSION_CLOSED/);
});

test('S94e restart factory failure still invalidates pending batch and permits later recovery',async()=>{
  // Force a failure through one explicit factory call, not source state.
  // Separate instance with an intentionally throwing factory after creation.
  let revision='r1';let attempts=0;const doc=makeDoc(['a','a:=2+3']),workers=[];
  function makeWorker(){attempts++;if(attempts===2)throw new Error('STARTUP_FAILED');
    const listeners=new Map(),sent=[];const w={sent,postMessage(m){sent.push(m)},
      addEventListener(k,fn){listeners.set(k,fn)},removeEventListener(k){listeners.delete(k)},
      terminate(){},fire(k,x){listeners.get(k)?.(k==='message'?{data:x}:{})}};
    workers.push(w);return w;
  }
  const session=createSupervisedSemanticTaskSession({runtime:doc,createWorker:makeWorker,
    supervision:{timeoutMs:1000,maxPending:1},getCurrentRevision:()=>revision,
    advanceRevision:()=>revision=`r${Number(revision.slice(1))+1}`,
    createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
      createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate:evaluateSelected})});
  const pending=session.run();
  assert.throws(()=>session.restart(),/STARTUP_FAILED/);
  assert.equal((await pending).kind,'stale');
  assert.equal(doc.getBlock('a').calculation.status,'idle');
  assert.equal(attempts,2);
  assert.equal(session.restart(),'r3'); // recovery after failed Worker factory
  const done=session.run();
  assert.equal(attempts,3);
  const current=workers[1];reply(current,await nextSent(current),5);
  assert.equal((await done).kind,'complete');
  assert.equal(val(doc,'a'),'5');session.close();
});

test('S94e source edit mid-flight is still guarded by the existing document generation',async()=>{
  const h=setup(),pending=h.session.run(),w=h.workers[0];
  const selected=await nextSent(w);
  h.doc.setBlockSource('a','a:=3+4');
  reply(w,selected,5);
  assert.equal((await pending).kind,'stale');
  assert.equal(h.doc.getBlock('a').source,'a:=3+4');
  assert.equal(h.doc.getBlock('a').calculation.result,null);
  h.session.close();
});

test('S94e rejects invalid session configuration before Worker creation',()=>{
  let count=0;
  assert.throws(()=>createSupervisedSemanticTaskSession({runtime:{evaluateAndCommitDirtySemanticTask(){}},
    createWorker:()=>{count++;return {};},getCurrentRevision:()=>'',advanceRevision(){},createEvaluate(){},
    supervision:{timeoutMs:100,maxPending:1}}),/requires/);
  assert.equal(count,0);
});
