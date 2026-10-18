/** S94f: a failing document revision reader must never strand a Worker request.
 * Transport owns error settlement; the document still owns its revision. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerEvaluationClient, PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {createSupervisedWorkerOwner} from '../../src/js/evaluation/create-supervised-worker-owner.js';
import {expression} from '../../src/js/values/value.js';

const envelope = (blockId='b') => ({protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId,taskScopeId:'t',source:'2+3',providers:[]});
const selected = (blockId='b') => ({revision:'r1',blockId,taskScopeId:'t',source:'2+3',evaluationRequest:{evaluatorId:'probe.scalar.add'},operationSpec:{evaluatorId:'probe.scalar.add'}});
const reply = request => ({protocol:PROTOCOL,kind:'result',requestId:request.requestId,revision:'r1',blockId:request.blockId,
  outcome:{blockId:request.blockId,status:'success',value:expression({op:'integer',value:'5'})}});
function mockWorker() {
  const listeners=new Map(), sent=[];let terminated=0;
  const worker={sent,
    postMessage(value){sent.push(value);},
    addEventListener(kind,fn){if(!listeners.has(kind))listeners.set(kind,new Set());listeners.get(kind).add(fn);},
    removeEventListener(kind,fn){listeners.get(kind)?.delete(fn);},
    terminate(){terminated++;},
    fire(kind,data){for(const fn of [...(listeners.get(kind)??[])])fn(kind==='message'?{data}:{});},
    get terminations(){return terminated;},
    listeners(kind){return listeners.get(kind)?.size??0;},
  };
  return worker;
}
const supervisor = {timeoutMs:500,maxPending:3};
async function checkFailures(promises,code) {
  const outcomes=await Promise.race([
    Promise.allSettled(promises),
    new Promise(resolve=>setTimeout(()=>resolve('NOT_SETTLED'),80)),
  ]);
  assert.notEqual(outcomes,'NOT_SETTLED','all pending requests must settle promptly, not await timeout');
  for(const outcome of outcomes){
    assert.equal(outcome.status,'rejected');
    assert.equal(outcome.reason.code,code);
    assert.equal(outcome.reason.diagnostic.code,code);
    assert.deepEqual(outcome.reason.diagnostic.parameters,{});
  }
}

test('S94f: thrown revision reader during a result rejects that request and all peers, closes owned Worker',async()=>{
  const worker=mockWorker();let readerBroken=false;
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>{
    if(readerBroken)throw new Error('SECRET_REVISION_BACKEND_DETAILS');return 'r1';
  },supervision:supervisor});
  const a=client.evaluate(envelope('a'),selected('a'));
  const b=client.evaluate(envelope('b'),selected('b'));
  readerBroken=true;
  assert.doesNotThrow(()=>worker.fire('message',reply(worker.sent[0])));
  await checkFailures([a,b],'WORKER_REVISION_UNAVAILABLE');
  assert.equal(worker.terminations,1);
  for(const kind of ['message','error','messageerror'])assert.equal(worker.listeners(kind),0);
  await assert.rejects(client.evaluate(envelope('c'),selected('c')),
    error=>error.code==='WORKER_REVISION_UNAVAILABLE' && error.diagnostic?.code===error.code);
  assert.equal(worker.sent.length,2);
  worker.fire('message',reply(worker.sent[1]));
  assert.equal(worker.terminations,1);
});

test('S94f: revision reader failure before dispatch rejects and revokes an already pending request',async()=>{
  const worker=mockWorker();let calls=0;
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>{
    if(++calls>=2)throw new Error('SECRET_REVISION_READER_DETAILS');return 'r1';
  },supervision:supervisor});
  const first=client.evaluate(envelope('a'),selected('a'));
  const next=client.evaluate(envelope('b'),selected('b'));
  await checkFailures([first,next],'WORKER_REVISION_UNAVAILABLE');
  assert.equal(worker.sent.length,1,'second request must not dispatch');
  assert.equal(worker.terminations,1);
});

test('S94f: unsupervised client rejects on broken reader but does not terminate an unowned Worker',async()=>{
  const worker=mockWorker();let broken=false;
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>{
    if(broken)throw new Error('private');return 'r1';
  }});
  const first=client.evaluate(envelope(),selected());broken=true;
  assert.doesNotThrow(()=>worker.fire('message',reply(worker.sent[0])));
  await checkFailures([first],'WORKER_REVISION_UNAVAILABLE');
  assert.equal(worker.terminations,0);
  await assert.rejects(client.evaluate(envelope(),selected()),/WORKER_REVISION_UNAVAILABLE/);
});

test('S94f: normal stale revision remains STALE_REVISION and does not kill healthy Worker',async()=>{
  const worker=mockWorker();let revision='r1';
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:supervisor});
  const stale=client.evaluate(envelope(),selected());revision='r2';
  worker.fire('message',reply(worker.sent[0]));
  await assert.rejects(stale,/STALE_REVISION/);
  assert.equal(worker.terminations,0);
  client.close();
  assert.equal(worker.terminations,1);
});

test('S94f: higher owner may explicitly restart with a healthy reader; no automatic replay',async()=>{
  let broken=false;const workers=[];
  const owner=createSupervisedWorkerOwner({createWorker:()=>{
    const worker=mockWorker();workers.push(worker);return worker;
  },getCurrentRevision:()=>{if(broken)throw new Error('private');return 'r1';},supervision:supervisor});
  const old=owner.evaluate(envelope(),selected());broken=true;
  assert.doesNotThrow(()=>workers[0].fire('message',reply(workers[0].sent[0])));
  await checkFailures([old],'WORKER_REVISION_UNAVAILABLE');
  broken=false;
  owner.restart();assert.equal(workers.length,2);
  assert.equal(workers[1].sent.length,0);
  const fresh=owner.evaluate(envelope(),selected());
  workers[1].fire('message',reply(workers[1].sent[0]));
  assert.equal((await fresh).value.data.expr.value,'5');
  owner.close();
});
