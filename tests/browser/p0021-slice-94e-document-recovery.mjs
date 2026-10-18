/** S94e browser acceptance: actual module Worker + real P0021 runtime orchestration.
 * Math is a deliberately tiny test fixture. S94b separately proved real Pyodide.
 */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';

const run=document.getElementById('run'),status=document.getElementById('status'),log=document.getElementById('log');
const write=s=>{log.textContent+=`${s}\n`;};
const check=(cond,label)=>{if(!cond)throw new Error(`FAIL: ${label}`);write(`PASS: ${label}`);};
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
const make=()=>{
  const doc=new DocumentRuntime({calculate(){throw Error('legacy invoked');}},'s94e-browser');
  doc.addBlock({id:'a',taskId:'default',type:'formula',source:'a:=2+3'});
  let revNo=1,workerNo=0;
  const session=createSupervisedSemanticTaskSession({runtime:doc,
    getCurrentRevision:()=>`browser-${revNo}`,
    advanceRevision:()=>{revNo++;},
    createWorker:()=>new Worker(new URL('./p0021-slice-94e-math-fixture-worker.mjs',import.meta.url),
      {type:'module',name:workerNo++===0?'hang':'math'}),
    supervision:{timeoutMs:500,maxPending:1},
    createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
      createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate:evaluateSelected}),
  });
  return {doc,session,get workerCount(){return workerNo;}};
};
run.addEventListener('click',async()=>{
  run.disabled=true;log.textContent='';status.className='pending';status.textContent='Tester dokument og Worker-genstart…';
  let h;
  try{
    h=make();const initialGeneration=h.doc.getBlock('a').calculation.generation;
    const first=await h.session.run();
    check(first.kind==='complete'&&h.doc.getBlock('a').calculation.error?.diagnostic?.code==='WORKER_TIMEOUT',
      'Timeout registreres som en struktureret diagnose i dokumentet');
    check(h.doc.getBlock('a').source==='a:=2+3'&&h.doc.getBlock('a').calculation.generation===initialGeneration,
      'Kildetekst og blokgeneration overlever timeout');
    h.session.restart();
    check(h.workerCount===2&&h.doc.getBlock('a').calculation.status==='error',
      'Eksplicit genstart starter ny Worker men genberegner ikke automatisk');
    const second=await h.session.run();
    check(second.kind==='complete'&&h.doc.getBlock('a').calculation.status==='success',
      'Eksplicit nyt kald genberegner den fejlede blok');
    check(h.doc.getBlock('a').calculation.result?.data?.expr?.value==='5',
      'Valgt matematik-IR udføres via ny Worker uden legacy-engine');
    status.className='pass';status.textContent='PASS — 5 dokument-/Worker-kontroller';
  }catch(error){status.className='fail';status.textContent='FAIL — se log';write(String(error?.stack??error));}
  finally{h?.session.close();run.disabled=false;}
});
