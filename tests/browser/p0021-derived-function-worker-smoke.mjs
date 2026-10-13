/** Slice 37: real Pyodide/SymPy -> derivative Value -> immutable FunctionValue -> selected Worker arithmetic. */
import {binderIdentity,identityKey} from '../../src/js/semantics/identity.js?v=slice38-shared-worker-value-v1';
import {functionValue,expression,isValue} from '../../src/js/values/value.js?v=slice38-shared-worker-value-v1';
import {operationSpec} from '../../src/js/operations/operation-spec.js?v=slice38-shared-worker-value-v1';
import {compileSelectedFunctionDerivative} from '../../src/js/semantics/compile-selected-function-derivative.js?v=slice38-shared-worker-value-v1';
import {materializeSelectedDerivativeFunction} from '../../src/js/semantics/materialize-selected-derivative-function.js?v=slice38-shared-worker-value-v1';
import {evaluateSelectedFunctionApplication} from '../../src/js/semantics/evaluate-selected-function-application.js?v=slice38-shared-worker-value-v1';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js?v=slice38-shared-worker-value-v1';
const REV='slice38-shared-worker-value-v1';
const button=document.getElementById('run'),status=document.getElementById('status'),log=document.getElementById('log');
const write=s=>{log.textContent+=s+'\n';};
const int=n=>({op:'integer',value:String(n)});
const identity=binderIdentity('slice37:f:parameter','x');
const sym={op:'symbolRef',identity};
const fn=functionValue([{identity}],expression({op:'add',args:[{op:'pow',base:sym,exponent:int(3)},{op:'mul',args:[int(4),sym]}]}),[]);
const diffSpec=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
const arithmetic=(name,evaluatorId)=>operationSpec({operationId:name,evaluatorId,arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
const specs=new Map([['add',arithmetic('add','probe.scalar.add')],['multiply',arithmetic('multiply','probe.scalar.multiply')],['power',arithmetic('power','probe.scalar.power')]]);
const env=(blockId,source)=>({protocol:'newcas.semantic-evaluation.v1',revision:REV,blockId,taskScopeId:'task',source,providers:[]});
async function check(client){
 const source=env('derived-f','f(x):=x^3+4x; x:=12');
 const selected=compileSelectedFunctionDerivative({fn,envelope:source,spec:diffSpec});
 const target=selected.evaluationRequest.inputs[1].data.expr;
 if(target.op!=='symbolRef'||identityKey(target.identity)!==identityKey(identity))throw Error('Differentiation binder changed');
 write('PASS: symbolic derivative targets the lexical binder (not document x:=12)');
 const response=await client.evaluate(source,selected);
 if(response.status!=='success'||response.value?.kind!=='expression')throw Error('Real Worker differentiation failed: '+JSON.stringify(response));
 // Worker transport returns a JSON clone: freeze/validate before identity-sensitive use.
 const derivative=response.value;
 if(!isValue(derivative))throw Error('Worker derivative not restored to P0005 Value');
 write('PASS: transported derivative restored to validated immutable P0005 Value');
 const derived=materializeSelectedDerivativeFunction({fn,derivative,targetIdentity:identity});
 if(derived.kind!=='function'||identityKey(derived.data.parameters[0].identity)!==identityKey(identity)||!Object.isFrozen(derived))throw Error('Derived FunctionValue did not preserve immutable binder');
 write('PASS: real SymPy derivative materializes as immutable FunctionValue with same binder');
 const calculate=async (x,expected)=>{
   const result=await evaluateSelectedFunctionApplication({fn:derived,args:[expression(int(x))],envelope:env('call-'+x,'f\u2032('+x+')'),specs,evaluate:client.evaluate});
   if(result.kind!=='expression'||result.data.expr.op!=='integer'||result.data.expr.value!==String(expected))throw Error(`f'(${x}) expected ${expected}: `+JSON.stringify(result));
   write(`PASS: derived FunctionValue called through real Worker: f'(${x}) = ${expected}`);
 };
 await calculate(0,4);await calculate(1,7);await calculate(12,436);
 return 6;
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Starter rigtig Pyodide Worker…';status.className='';log.textContent='';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js?v=slice38-shared-worker-value-v1',import.meta.url),{type:'module'});
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>REV});let timeout;
 try{const passed=await Promise.race([check(client),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120s')),120000)})]);status.textContent=`PASS — ${passed} browserkontroller`;status.className='pass';}
 catch(error){status.textContent='FAIL — se log';status.className='fail';write(String(error?.stack??error));}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;}
});
