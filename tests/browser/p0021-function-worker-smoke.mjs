/** P0021 Slice 33: real Pyodide/SymPy browser proof for document-bound FunctionValue. */
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {createBoundFunctionTaskEvaluator} from '../../src/js/semantics/create-bound-function-task-evaluator.js';
import {dispatchSemanticEvaluationBatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {expression} from '../../src/js/values/value.js';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';

const REVISION='slice33-real-function-worker-v1';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
const fn=materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse('f(x):=x^3+4x'),{
  writerId:'writer-f',taskScopeId:'task',specs,
  makeBinderId:({index})=>`slice33-f-binder-${index}`,
  resolveVariable:()=>providerReference('not-a-local-binder'),
}),{captures:[]});
const snapshot={taskScopeId:'task',blocks:[{blockId:'consumer',calls:[{
  name:'f',classification:'document-writer',candidates:['document-writer'],providerId:'writer-f',
}]}]};
const task={blockId:'consumer',taskScopeId:'task',source:'f(x)',
  providers:[{name:'f',providerId:'writer-f'}],upstream:['writer-f']};
const batch={tasks:[task],cycles:[],blocked:[]};
const button=document.getElementById('run');
const status=document.getElementById('status');
const log=document.getElementById('log');
const write=s=>{log.textContent+=s+'\n';};
function assertInteger(value,expected) {
  if(value?.kind!=='expression'||value.data?.expr?.op!=='integer'||value.data.expr.value!==expected)
    throw Error(`Expected ${expected}, received ${JSON.stringify(value)}`);
}
async function compute({client,args,providerId='writer-f',value=fn}) {
  const getProviderOutcome=id=>id===providerId?{blockId:id,status:'success',value}:null;
  let workerCalls=0;
  const evaluate=(...params)=>{workerCalls++;return client.evaluate(...params);};
  const taskEvaluator=createBoundFunctionTaskEvaluator({
    snapshot,blockId:'consumer',expectedName:'f',args,specs,evaluate,
    getProviderOutcome,revision:REVISION,
  });
  const cachedOutcomes=new Map([['writer-f',{revision:REVISION,outcome:{blockId:'writer-f',status:'success',value:fn}}]]);
  const result=await dispatchSemanticEvaluationBatch(batch,{
    revision:REVISION,getCurrentRevision:()=>REVISION,evaluate:taskEvaluator,cachedOutcomes,
  });
  return {result,workerCalls};
}
async function run(client) {
  // Source x:=12 is represented by the document-supplied argument; f's x remains a binder.
  if(fn.data.parameters[0].identity.kind!=='binder')throw Error('FunctionValue lacks local binder');
  write('PASS: f(x):=x^3+4x has a local binder independent of document x:=12');
  const first=await compute({client,args:[integer(12)]});
  if(first.result.kind!=='complete'||first.result.state.outcomes[0]?.status!=='success'||!first.workerCalls)
    throw Error('Function invocation did not reach real Worker: '+JSON.stringify(first));
  assertInteger(first.result.state.outcomes[0].value,'1776');
  write('PASS: f(document x:=12) = 1776 through real Worker/Pyodide/SymPy');
  const second=await compute({client,args:[integer(3)]});
  if(second.result.kind!=='complete'||second.result.state.outcomes[0]?.status!=='success'||!second.workerCalls)
    throw Error('Second invocation did not reach real Worker: '+JSON.stringify(second));
  assertInteger(second.result.state.outcomes[0].value,'39');
  write('PASS: f(3) = 39 with the same immutable FunctionValue');
  const rejected=await compute({client,args:[integer(12)],providerId:'old-writer-f'});
  if(rejected.result.kind!=='complete'||rejected.result.state.outcomes[0]?.status!=='failure'||rejected.workerCalls!==0)
    throw Error('Wrong provider was not rejected before Worker dispatch: '+JSON.stringify(rejected));
  write('PASS: wrong function provider fails closed, no Worker request or name fallback');
  return 4;
}
button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Starter rigtig Pyodide Worker…';status.className='';log.textContent='';
  const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js?v=slice33-real-function-worker-v1',import.meta.url),{type:'module'});
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>REVISION});
  let timeout;
  try {
    const count=await Promise.race([run(client),new Promise((_,reject)=>{
      timeout=setTimeout(()=>reject(Error('Timeout: 120 s')),120000);
    })]);
    status.textContent=`PASS — ${count} browserkontroller`;status.className='pass';
  } catch(error) {
    status.textContent='FAIL — se log';status.className='fail';write(String(error?.stack??error));
  } finally {
    clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;
  }
});
