/** S94d: stable P0009 facts travel from Worker transport through the existing
 * semantic batch to DocumentRuntime. No user text/i18n or second error store. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerTransportError} from '../../src/js/evaluation/worker-transport-diagnostics.js';
import {createSupervisedWorkerOwner} from '../../src/js/evaluation/create-supervised-worker-owner.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {isDiagnostic, diagnostic} from '../../src/js/diagnostics/diagnostic.js';

const input = (source='2') => ({
  envelope:{protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'a',taskScopeId:'default',source,providers:[]},
  selection:{revision:'r1',blockId:'a',taskScopeId:'default',source,evaluationRequest:{},operationSpec:{}},
});
const runtime = (...rows) => {
  const doc=new DocumentRuntime({calculate(){throw new Error('legacy called');}},'doc');
  for (const [id,source] of rows) doc.addBlock({id,source,type:'formula',taskId:'default'});
  return doc;
};
const run = (doc,evaluate,getCurrentRevision=()=> 'r1') => doc.evaluateAndCommitSemanticTask('default',{
  revision:'r1',getCurrentRevision,evaluate,
});
function fakeWorker() {
  const listeners=new Map(); const sent=[]; let terminated=0;
  const worker={
    postMessage(m){sent.push(m);},
    addEventListener(type,fn){if(!listeners.has(type)) listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    terminate(){terminated++;},
    fire(type){for(const fn of [...(listeners.get(type)??[])]) fn({});},
    sent,get terminated(){return terminated;},
  };
  return worker;
}

for (const code of ['WORKER_CRASH','WORKER_MESSAGE_ERROR','WORKER_CLIENT_CLOSED',
  'WORKER_CORRELATION_MISMATCH','INVALID_WORKER_OUTCOME','INVALID_WORKER_VALUE',
  'WORKER_OWNER_CLOSED','WORKER_OWNER_UNAVAILABLE','WORKER_GENERATION_STALE']) {
  test(`S94d ${code} is a P0009 immutable parameterless diagnostic`,()=>{
    const err=createWorkerTransportError(code);
    assert.equal(err.message,code);assert.equal(err.code,code);
    assert.deepEqual(err.diagnostic,{diagnosticVersion:1,code,parameters:{}});
    assert.ok(isDiagnostic(err.diagnostic));
    assert.ok(Object.isFrozen(err.diagnostic.parameters));
    assert.ok(!Object.hasOwn(err.diagnostic,'severity'));
  });
}

test('S94d deadline and capacity have strict integer parameters, not UI wording',()=>{
  const timed=createWorkerTransportError('WORKER_TIMEOUT',{timeoutMs:10000});
  const limited=createWorkerTransportError('WORKER_PENDING_LIMIT',{maxPending:2});
  assert.equal(timed.diagnostic.parameters.timeoutMs,10000);
  assert.equal(limited.diagnostic.parameters.maxPending,2);
  assert.ok(isDiagnostic(timed.diagnostic));
  assert.throws(()=>createWorkerTransportError('WORKER_TIMEOUT'),/requires parameter/i);
  assert.throws(()=>createWorkerTransportError('WORKER_TIMEOUT',{timeoutMs:-1}),/non-negative/i);
  assert.throws(()=>createWorkerTransportError('WORKER_TIMEOUT',{timeoutMs:10,message:'Dansk tekst'}),/unexpected/i);
  assert.throws(()=>createWorkerTransportError('WORKER_CRASH',{rawError:new Error('oops')}),/unexpected/i);
  assert.throws(()=>createWorkerTransportError('UNTRUSTED_CODE'),/unknown Worker/i);
});

test('S94d real supervised-client timeout carries a P0009 diagnosis',async()=>{
  const worker=fakeWorker();const owner=createSupervisedWorkerOwner({createWorker:()=>worker,
    getCurrentRevision:()=> 'r1',supervision:{timeoutMs:12,maxPending:2}});
  const request=input();
  await assert.rejects(owner.evaluate(request.envelope,request.selection),err=>{
    assert.equal(err.message,'WORKER_TIMEOUT');
    assert.deepEqual(err.diagnostic.parameters,{timeoutMs:12});return true;
  });
  assert.equal(worker.terminated,1);
  owner.close();
});

test('S94d real Worker-crash event carries a P0009 diagnosis',async()=>{
  const worker=fakeWorker();const owner=createSupervisedWorkerOwner({createWorker:()=>worker,
    getCurrentRevision:()=> 'r1',supervision:{timeoutMs:1000,maxPending:1}});
  const request=input();const pending=owner.evaluate(request.envelope,request.selection);
  worker.fire('error');
  await assert.rejects(pending,err=>err.diagnostic?.code==='WORKER_CRASH');
  assert.equal(worker.terminated,1);owner.close();
});

test('S94d pending limit diagnostic does not kill a healthy Worker',async()=>{
  const worker=fakeWorker();const owner=createSupervisedWorkerOwner({createWorker:()=>worker,
    getCurrentRevision:()=> 'r1',supervision:{timeoutMs:1000,maxPending:1}});
  const request=input();const first=owner.evaluate(request.envelope,request.selection);
  await assert.rejects(owner.evaluate(request.envelope,request.selection),err=>
    err.diagnostic?.code==='WORKER_PENDING_LIMIT' && err.diagnostic.parameters.maxPending===1);
  assert.equal(worker.terminated,0);owner.close();await assert.rejects(first,/WORKER_CLIENT_CLOSED/);
});

test('S94d DocumentRuntime stores diagnostic alongside legacy code/message; no source mutation',async()=>{
  const doc=runtime(['a','2']);const before=doc.getBlock('a').calculation.generation;
  const result=await run(doc,async()=>{throw createWorkerTransportError('WORKER_TIMEOUT',{timeoutMs:25});});
  assert.equal(result.kind,'complete');
  const block=doc.getBlock('a');
  assert.equal(block.source,'2');assert.equal(block.calculation.generation,before);
  assert.equal(block.calculation.status,'error');
  assert.equal(block.calculation.error.code,'WORKER_TIMEOUT');
  assert.equal(block.calculation.error.message,'WORKER_TIMEOUT');
  assert.equal(block.calculation.error.diagnostic.parameters.timeoutMs,25);
  assert.ok(isDiagnostic(block.calculation.error.diagnostic));
});

test('S94d ordinary evaluator exceptions remain legacy EVALUATOR_ERROR, not guessed by message',async()=>{
  const doc=runtime(['a','2']);
  await run(doc,async()=>{throw new Error('WORKER_TIMEOUT');});
  assert.deepEqual(doc.getBlock('a').calculation.error,{
    code:'EVALUATOR_ERROR',message:'WORKER_TIMEOUT',
  });
});

test('S94d blocked downstream keeps its own failure; no synthetic root cause',async()=>{
  const doc=runtime(['a','x:=2'],['b','x+1']);
  const result=await run(doc,async task=>{
    if(task.blockId==='a')throw createWorkerTransportError('WORKER_CRASH');
    throw new Error('blocked dependent was evaluated');
  });
  assert.equal(result.kind,'complete');
  assert.equal(doc.getBlock('a').calculation.error.diagnostic.code,'WORKER_CRASH');
  assert.equal(doc.getBlock('b').calculation.error.code,'UPSTREAM_FAILED');
  assert.equal(doc.getBlock('b').calculation.error.diagnostic,undefined);
});

test('S94d source edit while Worker failure pending forbids stale commit',async()=>{
  const doc=runtime(['a','2']);let rejectWork;
  const deferred=new Promise((_,reject)=>rejectWork=reject);
  const pending=run(doc,()=>deferred);
  await Promise.resolve();doc.setBlockSource('a','3');
  rejectWork(createWorkerTransportError('WORKER_TIMEOUT',{timeoutMs:19}));
  const result=await pending;
  assert.equal(result.kind,'stale');
  assert.equal(doc.getBlock('a').source,'3');
  assert.equal(doc.getBlock('a').calculation.error,null);
});

test('S94d mismatched code/diagnostic in an outcome fails closed without partial commit',async()=>{
  const doc=runtime(['a','2']);
  await assert.rejects(run(doc,task=>({blockId:task.blockId,status:'failure',
    code:'WORKER_CRASH',message:'WORKER_CRASH',diagnostic:diagnostic('WORKER_TIMEOUT',{timeoutMs:7})})),
  /invalid or out-of-order outcome/);
  assert.equal(doc.getBlock('a').calculation.status,'idle');
});

test('S94d malformed diagnostic in an outcome fails closed, no weak fallback',async()=>{
  const doc=runtime(['a','2']);
  await assert.rejects(run(doc,task=>({blockId:task.blockId,status:'failure',
    code:'WORKER_CRASH',message:'WORKER_CRASH',diagnostic:{diagnosticVersion:1,code:'WORKER_CRASH',parameters:{}}})),
  /invalid or out-of-order outcome/);
  assert.equal(doc.getBlock('a').calculation.error,null);
});
