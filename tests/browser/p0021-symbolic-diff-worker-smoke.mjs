/** Slice 25: real Pyodide/SymPy Worker proof, no mock or Python scope. */
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {compileSelectedSymbolicDiff} from '../../src/js/semantics/compile-selected-symbolic-diff.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {LexicalIdentityScope} from '../../src/js/semantics/identity.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {expression} from '../../src/js/values/value.js';

const REVISION='slice25-symbolic-diff-browser-v1';
const diff=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
const power=operationSpec({operationId:'power',evaluatorId:'probe.scalar.pow',arguments:[{name:'base',role:'value'},{name:'exponent',role:'value'}]});
const specs=new Map([['diff',diff],['power',power]]);
const button=document.getElementById('run');
const status=document.getElementById('status');
const log=document.getElementById('log');
const write=s=>{log.textContent+=s+'\n';};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

async function run(client) {
  const x17=expression({op:'integer',value:'17'});
  const envelope={protocol:'newcas.semantic-evaluation.v1',revision:REVISION,blockId:'b-diff',taskScopeId:'task',source:'diff(x^2,x)',providers:[]};
  const compile=(source,providers=[],resolveVariable=()=>providerReference('writer-x'))=>{
    const ast=parse(source);
    const ir=compileSelectedSourceAst(ast,{specs,lexicalScope:new LexicalIdentityScope('task'),resolveVariable,makeLocalId:({name})=>'slice25-local:'+name});
    const bound={...envelope,source,providers};
    return {bound,selection:compileSelectedSymbolicDiff(bound,ir,diff)};
  };
  // The prior writer x:=17 exists in document semantics; diff's symbolic role must shadow it.
  const first=compile('diff(x^2,x)');
  const target=first.selection.evaluationRequest.inputs[1].data.expr;
  if(target.op!=='symbolRef'||target.identity.kind!=='operation-local'||first.selection.providerIds.length)throw Error('symbolic scope was captured by x:=17');
  write('PASS: document x:=17 does not capture the operation-local target');
  const outcome=await client.evaluate(first.bound,first.selection);
  if(outcome.status!=='success')throw Error('Worker diff failure: '+JSON.stringify(outcome));
  const value=outcome.value;
  if(value?.kind!=='expression'||value.data?.expr?.op!=='mul')throw Error('diff(x^2,x) did not yield a multiplication ExpressionValue: '+JSON.stringify(value));
  const result=JSON.stringify(value.data.expr);
  if(!result.includes('"value":"2"')||!result.includes('"symbolRef"')||!result.includes(JSON.stringify(target.identity)))throw Error('expected exact 2*x with unchanged identity: '+result);
  write('PASS: real Pyodide/SymPy returns exact 2*x with unchanged operation-local identity');
  // A *materialized* provider is different: it is not to be relabeled as the target x.
  const other=compile('diff(A,x)',[{name:'A',providerId:'writer-A',value:x17}],()=>providerReference('writer-A'));
  const second=await client.evaluate(other.bound,other.selection);
  if(second.status!=='success'||second.value?.data?.expr?.op!=='integer'||second.value.data.expr.value!=='0')throw Error('diff(materialized 17,x) must be zero: '+JSON.stringify(second));
  write('PASS: materialized provider value diff(17,x) = 0, without Python variable lookup');
  return 3;
}

button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Starter rigtig Pyodide Worker…';status.className='';log.textContent='';
  const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js?v=slice25-symbolic-diff-browser-v1',import.meta.url),{type:'module'});
  const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>REVISION});
  let timeout;
  try{
    const count=await Promise.race([run(client),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Timeout: 120 s')),120000);})]);
    status.textContent=`PASS — ${count} browserkontroller`;status.className='pass';
  }catch(error){status.textContent='FAIL — se log';status.className='fail';write(String(error?.stack??error));}
  finally{clearTimeout(timeout);client.close();worker.terminate();button.disabled=false;}
});
