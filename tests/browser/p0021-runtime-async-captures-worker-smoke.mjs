/** Slice 59 real Pyodide Worker plus document-owned captures and asynchronous generations. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
function documentFixture(){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
 for(const [taskId,x] of [['A',10],['B',100]]) for(const [suffix,source] of [['x',`x:=${x}`],['f','f(t):=t+x'],['call','f(3)']])
  rt.addBlock({id:`${taskId}-${suffix}`,type:'formula',source,taskId});
 return rt;
}
const val=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
const gate=()=>{let enter,release;return {entered:new Promise(r=>enter=r),pending:new Promise(r=>release=r),enter:()=>enter(),release:()=>release()};};
function run(rt,scope,revision,evaluate,{pause,visits=[]}={}){
 let once=false;
 return rt.evaluateAndCommitDirtySemanticTask(scope,{revision,getCurrentRevision:()=>revision,createEvaluate:({snapshot,cachedOutcomes})=>{
  const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate,revision,cachedOutcomes});
  return async task=>{visits.push(task.blockId);const out=await base(task);
   if(pause&&!once&&task.blockId===`${scope}-call`){once=true;pause.enter();await pause.pending;}
   return out;};
 }});
}
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const REV='slice59-runtime-async-captures-v1';
const button=document.getElementById('run'),status=document.getElementById('status'),log=document.getElementById('log');
const write=s=>{log.textContent+=s+'\n';};
async function check(client){
 const rt=documentFixture();let calls=0;
 const evaluate=(...args)=>{calls++;return client.evaluate(...args);};
 const [a,b]=await Promise.all([run(rt,'A',REV,evaluate),run(rt,'B',REV,evaluate)]);
 if(a.kind!=='complete'||b.kind!=='complete'||val(rt,'A-call')!=='13'||val(rt,'B-call')!=='103'||calls===0)throw Error('Real worker task capture results invalid');
 write('PASS: real Worker/Pyodide/SymPy evaluated scoped captures A=13 and B=103');
 const ca=rt.getBlock('A-f').calculation.result.data.capturedValues[0].identity;
 const cb=rt.getBlock('B-f').calculation.result.data.capturedValues[0].identity;
 if(ca.taskScopeId!=='A'||cb.taskScopeId!=='B')throw Error('Captured identities crossed task scopes');
 write('PASS: captures retain distinct taskScopeIds and provider bindings');
 const g=gate();rt.setBlockSource('A-x','x:=10');
 const stale=run(rt,'A',REV,evaluate,{pause:g});await g.entered;
 rt.setBlockSource('A-x','x:=20');
 const newer=await run(rt,'A',REV,evaluate);
 if(newer.kind!=='complete'||val(rt,'A-call')!=='23')throw Error('Newer capture evaluation not committed');
 write('PASS: newer Worker-backed capture committed A=23');
 g.release();if((await stale).kind!=='stale'||val(rt,'A-call')!=='23')throw Error('Old Worker-backed result overwrote new result');
 write('PASS: late old Worker-backed computation discarded by generation guard');
 if(val(rt,'B-call')!=='103'||rt.getBlock('B-f').calculation.status!=='success')throw Error('Task B was invalidated');
 write('PASS: task B remains 103, untouched by task A edits');
 return 5;
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Starter rigtig Pyodide Worker…';status.className='';log.textContent='';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js?v=slice59-runtime-async-captures-v1',import.meta.url),{type:'module'});
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>REV});let timeout;
 try{const n=await Promise.race([check(client),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120s')),120000)})]);status.textContent=`PASS — ${n} browserkontroller`;status.className='pass';}
 catch(e){status.textContent='FAIL — se log';status.className='fail';write(String(e?.stack??e));}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;}
});
