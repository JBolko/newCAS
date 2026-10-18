/** S94c: manual browser proof with genuine module Workers; never evaluates math. */
import {createSupervisedWorkerOwner} from '../../src/js/evaluation/create-supervised-worker-owner.js';

const run=document.getElementById('run'), status=document.getElementById('status'), log=document.getElementById('log');
const write=message=>{log.textContent+=`${message}\n`;};
const check=(condition,message)=>{if(!condition)throw new Error(`FAIL: ${message}`);write(`PASS: ${message}`);};
const REVISION='s94c-real-browser';
const request=(source,blockId='b1')=>({
  envelope:{protocol:'newcas.semantic-evaluation.v1',revision:REVISION,blockId,taskScopeId:'t1',source,providers:[]},
  selection:{revision:REVISION,blockId,taskScopeId:'t1',source,evaluationRequest:{},operationSpec:{}},
});
const send=(owner,source,blockId)=>{
  const {envelope,selection}=request(source,blockId);return owner.evaluate(envelope,selection);
};
async function rejectedWith(promise,code){
  try {await promise;throw new Error(`Expected ${code} but resolved`);}
  catch(error){if(error?.message!==code)throw error;}
}
const owner=(timeoutMs)=>createSupervisedWorkerOwner({
  createWorker:()=>new Worker(new URL('./p0021-slice-94b-transport-fixture-worker.mjs',import.meta.url),{type:'module'}),
  getCurrentRevision:()=>REVISION,supervision:{timeoutMs,maxPending:2},
});
run.addEventListener('click',async()=>{
  run.disabled=true;log.textContent='';status.className='pending';status.textContent='Genstarter rigtige Web Workers…';
  try {
    {
      const h=owner(250);
      try {
        await rejectedWith(send(h,'hang'),'WORKER_TIMEOUT');
        check(true,'Reel Worker med timeout stoppes og kaldet afvises');
        await rejectedWith(send(h,'failure'),'WORKER_TIMEOUT');
        check(true,'Ingen implicit genstart eller genafspilning efter timeout');
        h.restart();
        const outcome=await send(h,'failure');
        check(outcome.status==='failure'&&outcome.code==='EXPECTED_TEST_FAILURE',
          'Eksplicit genstart skaber en ny fungerende Worker');
      } finally {h.close();}
    }
    {
      const h=owner(5000);
      try {
        const p=send(h,'hang');h.restart();
        await rejectedWith(p,'WORKER_CLIENT_CLOSED');
        check(true,'Genstart afviser igangværende kald fra gammel Worker');
        const outcome=await send(h,'failure');
        check(outcome.code==='EXPECTED_TEST_FAILURE','Ny Worker besvarer et nyt kald');
      } finally {
        h.close();h.close();
        await rejectedWith(send(h,'failure'),'WORKER_OWNER_CLOSED');
        check(true,'Lukning er endelig; sessionen kan ikke genopstå');
      }
    }
    {
      const h=owner(5000);
      try {
        await rejectedWith(send(h,'crash'),'WORKER_CRASH');
        h.restart();
        const outcome=await send(h,'failure');
        check(outcome.code==='EXPECTED_TEST_FAILURE','Ny Worker virker efter reel Worker-crash');
      } finally {h.close();}
    }
    status.className='pass';status.textContent='PASS — 6 browserkontroller af eksplicit Worker-genstart';
  } catch(error) {
    status.className='fail';status.textContent='FAIL — se log';write(String(error?.stack??error));
  } finally {run.disabled=false;}
});
