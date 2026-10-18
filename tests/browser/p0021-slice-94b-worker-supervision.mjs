/** S94b: real browser Worker lifecycle proof, transport only (no Pyodide). */
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';

const run=document.getElementById('run');
const status=document.getElementById('status');
const log=document.getElementById('log');
const write=s=>{log.textContent+=s+'\n';};
const requireCondition=(condition,label)=>{
  if (!condition) throw new Error(`FAIL: ${label}`);
  write(`PASS: ${label}`);
};
const REVISION='s94b-browser';
const request=(source,blockId='block-1')=>({
  envelope:{protocol:'newcas.semantic-evaluation.v1',revision:REVISION,blockId,
    taskScopeId:'task-1',source,providers:[]},
  selection:{revision:REVISION,blockId,taskScopeId:'task-1',source,
    evaluationRequest:{},operationSpec:{}},
});
const start=(timeoutMs,maxPending)=>{
  const worker=new Worker(new URL('./p0021-slice-94b-transport-fixture-worker.mjs',import.meta.url),{type:'module'});
  try {
    const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>REVISION,
      supervision:{timeoutMs,maxPending}});
    return client;
  } catch (error) { worker.terminate();throw error; }
};
async function rejectedWith(promise,code){
  try { await promise; throw new Error(`Expected ${code}, but Promise resolved`); }
  catch(error) {
    if (error?.message!==code) throw error;
  }
}
run.addEventListener('click',async()=>{
  run.disabled=true;status.className='pending';status.textContent='Afprøver Worker-nedbrud og timeout…';log.textContent='';
  try {
    {
      const client=start(250,2);
      try {
        const a=request('hang','block-a'),b=request('hang','block-b');
        const waitingA=client.evaluate(a.envelope,a.selection);
        const waitingB=client.evaluate(b.envelope,b.selection);
        await Promise.all([rejectedWith(waitingA,'WORKER_TIMEOUT'),rejectedWith(waitingB,'WORKER_TIMEOUT')]);
        requireCondition(true,'Reel Worker uden svar: begge ventende kald afvist ved timeout');
        await rejectedWith(client.evaluate(a.envelope,a.selection),'WORKER_TIMEOUT');
        requireCondition(true,'Den terminerede klient afviser også nye kald');
      } finally {client.close();}
    }
    {
      const client=start(5000,1);
      try {
        const hanging=request('hang');
        const waiting=client.evaluate(hanging.envelope,hanging.selection);
        const other=request('hang','block-2');
        await rejectedWith(client.evaluate(other.envelope,other.selection),'WORKER_PENDING_LIMIT');
        requireCondition(true,'Kapacitetsloft afviser forespørgsler før dispatch');
        client.close();
        await rejectedWith(waiting,'WORKER_CLIENT_CLOSED');
        requireCondition(true,'Eksplicit lukning afviser ventende kald');
      } finally {client.close();}
    }
    {
      const client=start(5000,1);
      try {
        const broken=request('crash');
        await rejectedWith(client.evaluate(broken.envelope,broken.selection),'WORKER_CRASH');
        requireCondition(true,'Reel Worker-fejl giver terminal WORKER_CRASH');
        await rejectedWith(client.evaluate(broken.envelope,broken.selection),'WORKER_CRASH');
      } finally {client.close();}
    }
    {
      // A fresh Worker/client is allowed; no stale request is replayed.
      const client=start(5000,1);
      try {
        const next=request('failure');
        const outcome=await client.evaluate(next.envelope,next.selection);
        requireCondition(outcome.status==='failure'&&outcome.code==='EXPECTED_TEST_FAILURE',
          'Ny Worker accepterer et nyt kald og returnerer en struktureret fejl');
      } finally {client.close();}
    }
    status.className='pass';status.textContent='PASS — 6 browserkontroller af Worker-supervision';
  } catch(error) {
    status.className='fail';status.textContent='FAIL — se log';
    write(String(error?.stack??error));
  } finally {run.disabled=false;}
});
