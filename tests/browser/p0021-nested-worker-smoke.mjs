import { createWorkerEvaluationClient } from '../../src/js/evaluation/worker-evaluation-protocol.js';
import { evaluateNestedSelectedCalls } from '../../src/js/semantics/evaluate-nested-selected-calls.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import { valueLiteral, providerReference, operationReference, call, define } from '../../src/js/semantics/semantic-ir.js';
const button=document.getElementById('run'), status=document.getElementById('status'), log=document.getElementById('log');
const integer=n=>Object.freeze({valueVersion:1,kind:'expression',data:Object.freeze({expr:Object.freeze({op:'integer',value:String(n)})})});
const lit=n=>valueLiteral(integer(n));
const add=(a,b)=>call(operationReference('add'),[a,b]);
const spec=operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
const specs=new Map([['add',spec]]);
const write=s=>{log.textContent+=s+'\n';};
button.addEventListener('click',async()=>{
 button.disabled=true;log.textContent='';status.textContent='Indlæser Pyodide i Worker…';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
 const revision='nested-smoke-1';
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision});
 let timeout;
 try {
  const run=async()=>{
   const envelope={protocol:'newcas.semantic-evaluation.v1',revision,blockId:'b',taskScopeId:'task',source:'b := 2+(3+4)',providers:[]};
   const first=await evaluateNestedSelectedCalls({envelope,ir:define('b',add(lit(2),add(lit(3),lit(4)))),specs,evaluate:client.evaluate});
   if(first.data?.expr?.value!=='9')throw Error(`Forkert resultat for 2+(3+4): ${JSON.stringify(first)}`);
   write('PASS: 2+(3+4)=9 gennem rigtig Pyodide/SymPy Worker');
   const bound={...envelope,source:'b := 2+(a+3)',providers:[{name:'a',providerId:'writer-a',value:integer(5)}]};
   const second=await evaluateNestedSelectedCalls({envelope:bound,ir:define('b',add(lit(2),add(providerReference('writer-a'),lit(3)))),specs,evaluate:client.evaluate});
   if(second.data?.expr?.value!=='10')throw Error(`Forkert resultat for provider: ${JSON.stringify(second)}`);
   write('PASS: 2+(a+3)=10 med eksplicit provider writer-a');
   try {await evaluateNestedSelectedCalls({envelope:bound,ir:define('b',add(lit(2),add(providerReference('writer-other'),lit(3)))),specs,evaluate:client.evaluate});throw Error('Manglende provider blev accepteret');}
   catch(error){if(!String(error).includes('unknown provider identity'))throw error;}
   write('PASS: forkert provider-identitet afvist før dispatch');
  };
  await Promise.race([run(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120 s')),120000);})]);
  status.textContent='PASS — tre nested Worker-smoketests';status.className='pass';
 }catch(error){status.textContent='FAIL — se log';status.className='fail';write(String(error.stack??error));}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;}
});
