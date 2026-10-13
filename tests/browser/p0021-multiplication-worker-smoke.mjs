import { createWorkerEvaluationClient } from '../../src/js/evaluation/worker-evaluation-protocol.js';
import { evaluateNestedSelectedCalls } from '../../src/js/semantics/evaluate-nested-selected-calls.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import {valueLiteral,providerReference,operationReference,call,define} from '../../src/js/semantics/semantic-ir.js';
const button=document.getElementById('run'), status=document.getElementById('status'), log=document.getElementById('log');
const integer=n=>Object.freeze({valueVersion:1,kind:'expression',data:Object.freeze({expr:Object.freeze({op:'integer',value:String(n)})})});
const lit=n=>valueLiteral(integer(n));
const add=(a,b)=>call(operationReference('add'),[a,b]);
const mul=(a,b)=>call(operationReference('multiply'),[a,b]);
const spec=(name,id)=>operationSpec({operationId:name,evaluatorId:id,arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
const specs=new Map([['add',spec('add','probe.scalar.add')],['multiply',spec('multiply','probe.scalar.multiply')]]);
const write=s=>{log.textContent+=s+'\n';};
button.addEventListener('click',async()=>{
 button.disabled=true; log.textContent=''; status.textContent='Starter Pyodide i Worker…';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=> 'slice15'});let timeout;
 try{
  const run=async()=>{
   const envelope={protocol:'newcas.semantic-evaluation.v1',revision:'slice15',blockId:'b',taskScopeId:'task',source:'2+3*4',providers:[]};
   const value=await evaluateNestedSelectedCalls({envelope,ir:define('b',add(lit(2),mul(lit(3),lit(4)))),specs,evaluate:client.evaluate});
   if(value.data?.expr?.value!=='14')throw Error('2+3*4 != 14: '+JSON.stringify(value));
   write('PASS: 2+3*4 = 14 via valgt add/multiply → rigtig Pyodide/SymPy Worker');
   const withProvider={...envelope,source:'2+a*4',providers:[{name:'a',providerId:'writer-a',value:integer(3)}]};
   const next=await evaluateNestedSelectedCalls({envelope:withProvider,ir:define('b',add(lit(2),mul(providerReference('writer-a'),lit(4)))),specs,evaluate:client.evaluate});
   if(next.data?.expr?.value!=='14')throw Error('2+a*4 != 14: '+JSON.stringify(next));
   write('PASS: provider-identitet bevaret gennem indlejret multiplikation');
  };
  await Promise.race([run(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120s')),120000)})]);
  status.className='pass';status.textContent='PASS — 2 browserkontroller';
 }catch(error){status.className='fail';status.textContent='FAIL';write(String(error.stack??error));}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;}
});
