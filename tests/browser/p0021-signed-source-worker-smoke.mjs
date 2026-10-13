import {parse} from '../../src/js/parser.mjs';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {define} from '../../src/js/semantics/semantic-ir.js';
import {evaluateNestedSelectedCalls} from '../../src/js/semantics/evaluate-nested-selected-calls.js';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const spec=(id,n)=>operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:Array.from({length:n},(_,i)=>({name:`arg${i}`,role:'value'}))});
const specs=new Map([['add',2],['multiply',2],['power',2]].map(([n,a])=>[n,spec(n,a)]));
const button=document.getElementById('run'),status=document.getElementById('status'),log=document.getElementById('log');
const write=s=>log.textContent+=s+'\n';
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Starter Worker…';log.textContent='';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js?v=slice20-signs-v1',import.meta.url),{type:'module'});
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=> 'slice20'});
 let timeout;
 try {
  const calculate=async source=>{
   const ast=parse(source);const ir=compileSelectedSourceAst(ast,{specs});
   const envelope={protocol:'newcas.semantic-evaluation.v1',revision:'slice20',blockId:'b',taskScopeId:'task',source,providers:[]};
   return await evaluateNestedSelectedCalls({envelope,ir:define('b',ir),specs,evaluate:client.evaluate});
  };
  const run=async()=>{
   const cases=[['-2^3+4*5','12'],['(-2)^3+4*5','12'],['-2^2+4*5','16'],['(-2)^2+4*5','24'],['20-8/2','16'],['2^3+4*5','28']];
   for(const [source,expected] of cases){
    const result=await calculate(source);
    if(result?.data?.expr?.op!=='integer'||result.data.expr.value!==expected)throw Error(source+' forventet '+expected+', fik '+JSON.stringify(result));
    write('PASS: '+source+' = '+expected+' via Peggy → Worker → SymPy');
   }
   const p1=compileSelectedSourceAst(parse('-2^2'),{specs});const p2=compileSelectedSourceAst(parse('(-2)^2'),{specs});
   if(JSON.stringify(p1)===JSON.stringify(p2))throw Error('AST/IR-tab af fortegnsprioritet');
   write('PASS: -2^2 og (-2)^2 har forskellige IR-træer');
  };
  await Promise.race([run(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120s')),120000)})]);
  status.textContent='PASS — 7 Worker/parser-kontroller';status.className='pass';
 }catch(error){status.textContent='FAIL';status.className='fail';write(error.stack??String(error))}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false}
});
