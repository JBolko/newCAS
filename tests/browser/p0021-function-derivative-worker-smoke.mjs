/** Slice 35: actual Pyodide/SymPy differentiation of an immutable FunctionValue. */
import {binderIdentity} from '../../src/js/semantics/identity.js?v=slice35-function-derivative-v1';
import {functionValue,expression} from '../../src/js/values/value.js?v=slice35-function-derivative-v1';
import {operationSpec} from '../../src/js/operations/operation-spec.js?v=slice35-function-derivative-v1';
import {compileSelectedFunctionDerivative} from '../../src/js/semantics/compile-selected-function-derivative.js?v=slice35-function-derivative-v1';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js?v=slice35-function-derivative-v1';
const REV='slice35-function-derivative-v1';
const button=document.getElementById('run'),status=document.getElementById('status'),log=document.getElementById('log');
const write=s=>{log.textContent+=s+'\n';};
const n=value=>({op:'integer',value:String(value)});
const id=binderIdentity('slice35:f:parameter','x');
const sym={op:'symbolRef',identity:id};
const body={op:'add',args:[{op:'pow',base:sym,exponent:n(3)},{op:'mul',args:[n(4),sym]}]};
const fn=functionValue([{identity:id}],expression(body),[]);
const spec=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
const env={protocol:'newcas.semantic-evaluation.v1',revision:REV,blockId:'derived-f',taskScopeId:'task',source:'derivative of f(x):=x^3+4x; document x:=12',providers:[]};
function walk(node,predicate){if(!node||typeof node!=='object')return false;if(predicate(node))return true;return Object.values(node).some(v=>Array.isArray(v)?v.some(child=>walk(child,predicate)):walk(v,predicate));}
async function check(client){
 const selection=compileSelectedFunctionDerivative({fn,envelope:env,spec});
 const target=selection.evaluationRequest.inputs[1].data.expr;
 if(target.op!=='symbolRef'||JSON.stringify(target.identity)!==JSON.stringify(id)||selection.providerIds.length)throw Error('Original binder lost before Worker');
 write('PASS: selected diff request keeps function binder, not document x:=12');
 const outcome=await client.evaluate(env,selection);
 if(outcome.status!=='success')throw Error('Worker rejected differentiation: '+JSON.stringify(outcome));
 const value=outcome.value;
 if(value?.kind!=='expression')throw Error('Worker returned no ExpressionValue: '+JSON.stringify(value));
 const expr=value.data.expr;
 if(!walk(expr,node=>node.op==='symbolRef'&&JSON.stringify(node.identity)===JSON.stringify(id)))throw Error('Function binder lost in SymPy result: '+JSON.stringify(expr));
 if(walk(expr,node=>node.op==='symbolRef'&&JSON.stringify(node.identity)!==JSON.stringify(id)))throw Error('Unknown symbol in derivative: '+JSON.stringify(expr));
 write('PASS: real Pyodide/SymPy result retains exact lexical binder');
 // Check mathematics through the existing P0005 expression tree, without accepting string formatting.
 const compute=(node,x)=>{switch(node.op){case 'integer':return BigInt(node.value);case 'rational':{const a=BigInt(node.numerator),b=BigInt(node.denominator);if(a%b!==0n)throw Error('Noninteger rational in test');return a/b;}case 'symbolRef':if(JSON.stringify(node.identity)!==JSON.stringify(id))throw Error('Wrong binder');return BigInt(x);case 'add':return node.args.reduce((a,v)=>a+compute(v,x),0n);case 'mul':return node.args.reduce((a,v)=>a*compute(v,x),1n);case 'pow':return compute(node.base,x)**compute(node.exponent,x);default:throw Error('Unsupported derivative expression shape: '+JSON.stringify(node));}};
 for(const [x,expected] of [[0,4n],[1,7n],[12,436n]]){const actual=compute(expr,x);if(actual!==expected)throw Error(`Derivative at ${x}: expected ${expected}, got ${actual}`);}
 write('PASS: derivative expression evaluates to 4, 7, 436 at x=0,1,12');
 return 3;
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Starter rigtig Pyodide Worker…';status.className='';log.textContent='';
 const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js?v=slice35-function-derivative-v1',import.meta.url),{type:'module'});
 const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>REV});let timeout;
 try{const result=await Promise.race([check(client),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Timeout 120s')),120000)})]);status.textContent=`PASS — ${result} browserkontroller`;status.className='pass';}
 catch(err){status.textContent='FAIL — se log';status.className='fail';write(String(err?.stack??err));}
 finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;}
});
