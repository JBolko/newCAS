/** P0021 Slice 83 — actual active DocumentRuntime IR batch backed by real Worker/Pyodide/SymPy.
 * No legacy bound-function adapter, no JS arithmetic fallback and no source parsing in Python.
 * Manual browser acceptance; DO NOT label GREEN until run in a real browser.
 */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';

const run=document.getElementById('run');
const status=document.getElementById('status');
const log=document.getElementById('log');
const write=s=>{log.textContent+=`${s}\n`;};
const assert=(condition,label)=>{if(!condition)throw new Error(`FAIL: ${label}`);write(`PASS: ${label}`);};
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
function populate(runtime,taskId,initial){
  for(const [suffix,source] of [
    ['a',`a:=${initial}`],['f','f(t):=t^2+a'],['g','g(t):=3t'],
    ['result','f(g(4))'],['assigned','answer:=f(g(4))+1'],['read','answer'],
  ]) runtime.addBlock({id:`${taskId}-${suffix}`,taskId,type:'formula',source});
}
const value=(runtime,id)=>runtime.getBlock(id).calculation.result?.data?.expr?.value;
run.addEventListener('click',async()=>{
  run.disabled=true;log.textContent='';status.className='pending';status.textContent='Starter rigtig Pyodide-Worker…';
  let worker,client,operations=0;
  try{
    // One Worker and one transport client, with revision context set before each sequential batch.
    // DocumentRuntime remains sole authority for the actual document generations.
    worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
    let workerRevision='s83-init';
    // S94b: this client exclusively owns the selected Worker. Every actual
    // backend request is supervised, including initial Pyodide startup.
    client=createWorkerEvaluationClient({
      worker,
      getCurrentRevision:()=>workerRevision,
      supervision:{timeoutMs:180_000,maxPending:1},
    });
    const evaluate=async(envelope,selection)=>{
      operations++;
      // This is the real selected-worker transport, not a fake Python computation.
      return client.evaluate(envelope,selection);
    };
    const rt=new DocumentRuntime({calculate:async()=>{throw Error('Legacy CASEngine called');}},'slice83');
    populate(rt,'A',2);populate(rt,'B',10);
    async function batch(taskId,revision){
      workerRevision=revision;
      const {snapshot}=rt.deriveSemanticTask(taskId);
      const execute=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate,revision});
      return rt.evaluateAndCommitSemanticTask(taskId,{
        revision,getCurrentRevision:()=>workerRevision,evaluate:execute,
      });
    }
    assert((await batch('A','s83-A-1')).kind==='complete','Task A: active IR batch with actual Pyodide Worker');
    assert(value(rt,'A-result')==='146'&&value(rt,'A-read')==='147','Task A: f(g(4))=146; answer=147');
    assert((await batch('B','s83-B-1')).kind==='complete','Task B: independent real Worker batch');
    assert(value(rt,'B-result')==='154'&&value(rt,'B-read')==='155','Task B: identical identifiers, distinct providers → 154/155');
    rt.setBlockSource('A-a','a:=5');
    assert((await batch('A','s83-A-2')).kind==='complete','Capture change recomputed through real Worker');
    assert(value(rt,'A-result')==='149'&&value(rt,'A-read')==='150','Task A: new captured a=5 → 149/150');
    assert(value(rt,'B-result')==='154'&&value(rt,'B-read')==='155','Task B remains unchanged');
    assert(operations>0,'Real Worker received selected OperationSpec requests');
    write(`Worker operations evaluated: ${operations}`);
    write('Actual selected Pyodide Worker is used for arithmetic; function binding and capture resolution remain in JS.');
    status.className='pass';status.textContent='PASS — aktiv IR gennem rigtig Pyodide/SymPy-Worker';
  }catch(error){
    status.className='fail';status.textContent='FAIL — se log';write(`ERROR: ${error?.stack??error}`);
  }finally{
    // Only the supervising client terminates an accepted, exclusively owned Worker.
    // If client construction failed, its caller still owns the unclaimed Worker.
    if(client) client.close();
    else worker?.terminate();
    run.disabled=false;
  }
});
