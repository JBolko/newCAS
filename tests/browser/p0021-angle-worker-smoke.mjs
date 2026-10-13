import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {evaluateNestedSelectedCalls} from '../../src/js/semantics/evaluate-nested-selected-calls.js';
import {withSelectedAngleUnit} from '../../src/js/semantics/with-selected-angle-unit.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {valueLiteral,operationReference,call,define} from '../../src/js/semantics/semantic-ir.js';
const button=document.getElementById('run'),status=document.getElementById('status'),log=document.getElementById('log');
import {smokeIntegerValue} from './p0021-smoke-value-fixtures.mjs';
const integer=smokeIntegerValue;
const lit=n=>valueLiteral(integer(n));
const op=(name,...args)=>call(operationReference(name),args);
const spec=(id,args)=>operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:args.map((name)=>({name,role:'value'}))});
const specs=new Map([['add',spec('add',['lhs','rhs'])],['multiply',spec('multiply',['lhs','rhs'])],['sin',spec('sin',['argument'])]]);
const write=s=>log.textContent+=s+'\n';
button.addEventListener('click',async()=>{
 button.disabled=true;log.textContent='';status.textContent='Starter Worker…';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=> 'slice16'});let timeout;
 try{
  const run=async()=>{
   const envelope={protocol:'newcas.semantic-evaluation.v1',revision:'slice16',blockId:'b',taskScopeId:'task',source:'smoke',providers:[]};
   const compute=(ir,angleUnit)=>evaluateNestedSelectedCalls({envelope,ir:define('b',ir),specs,evaluate:withSelectedAngleUnit(client.evaluate,angleUnit)});
   const mul=await compute(op('add',lit(2),op('multiply',lit(3),lit(4))),'rad');
   if(mul.data?.expr?.value!=='14')throw Error('Multiplikation: '+JSON.stringify(mul));
   write('PASS: 2+3*4 = 14 (rigtig Pyodide Worker)');
   const rad=await compute(op('sin',op('add',lit(0),lit(0))),'rad');
   if(rad.data?.expr?.value!=='0')throw Error('sin(0) rad: '+JSON.stringify(rad));
   write('PASS: sin(0) = 0 i radianer');
   const deg=await compute(op('sin',op('add',lit(23),op('multiply',lit(3),lit(5)))),'deg');
   if(!deg || deg.kind!=='expression')throw Error('sin(38°) mangler Value: '+JSON.stringify(deg));
   write('PASS: sin(23+3*5) i grader → ExpressionValue: '+JSON.stringify(deg.data?.expr));
   const ninety=await compute(op('sin',lit(90)),'deg');
   if(ninety.data?.expr?.value!=='1')throw Error('sin(90°): '+JSON.stringify(ninety));
   write('PASS: sin(90°) = 1 eksakt');
  };
  await Promise.race([run(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120s')),120000)})]);
  status.className='pass';status.textContent='PASS — 4 Worker-kontroller';
 }catch(e){status.className='fail';status.textContent='FAIL';write(String(e.stack??e))}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false}
});
