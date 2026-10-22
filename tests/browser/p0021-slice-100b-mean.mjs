/** S100b: internal Values only, actual supervised Worker/Pyodide/SymPy. */
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {expression,list,vector,isValue} from '../../src/js/values/value.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {evaluateNestedSelectedCalls} from '../../src/js/semantics/evaluate-nested-selected-calls.js';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {diagnosticSpec,diagnosticFromSpec} from '../../src/js/diagnostics/diagnostic.js';

const integer = value=>expression({op:'integer',value:String(value)});
const results=[], workerCalls=[];
const check=(ok,message)=>{if(!ok)throw Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const spec=findSelectedOperationSpec('mean');
const envelope={protocol:'newcas.semantic-evaluation.v1',revision:'s100b-1',blockId:'internal',
  taskScopeId:'internal-fixture',source:'internal Value fixture; not parsed',providers:[]};
const ir=input=>call(operationReference('mean'),[valueLiteral(input)]);
const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>envelope.revision,
  supervision:{timeoutMs:180000,maxPending:1}});
const evaluate=(env,selection)=>{
  workerCalls.push(selection.evaluationRequest.evaluatorId);
  return client.evaluate(env,selection);
};
const mismatchSpec=diagnosticSpec({code:'type-mismatch',parameters:{operationId:'string',
  argument:'string',expectedKinds:'string-list',actualKind:'string'}});
try{
  const groups=[
    ['integer mean 5',[[['2','4','6','8'],{op:'integer',value:'5'}]]],
    ['exact reduced rational',[[['1','2','4'],{op:'rational',numerator:'7',denominator:'3'}],
      [['-2','1'],{op:'rational',numerator:'-1',denominator:'2'}]]],
    ['repeats, negative values and large integer strings',[
      [['-2','4','4'],{op:'integer',value:'2'}],
      [['9007199254740993'],{op:'integer',value:'9007199254740993'}],
      [['9007199254740993','9007199254740995'],{op:'integer',value:'9007199254740994'}],
      [['-4','4'],{op:'integer',value:'0'}]]],
  ];
  for(const [label,cases] of groups){
    for(const [numbers,expected] of cases){
      const input=list(numbers.map(integer)),before=JSON.stringify(input);
      const value=await evaluateNestedSelectedCalls({envelope,ir:ir(input),
        specs:new Map([['mean',spec]]),evaluate});
      check(same(value,expression(expected)),label+': exact result');
      check(isValue(value)&&Object.isFrozen(value.data.expr),'rehydrated frozen output');
      check(JSON.stringify(input)===before&&Object.isFrozen(input.data.items),'immutable input');
    }
    results.push('PASS: '+label);
  }
  const failures=[
    ['VectorValue rejected',[[vector([integer('2')]),'list','vector']]],
    ['empty list and wrong element types',[
      [list([]),'nonempty-list-of-exact-rational-expressions','list'],
      [list([expression({op:'approx',value:'2.0'})]),'nonempty-list-of-exact-rational-expressions','list'],
      [list([expression({op:'constant',name:'pi'})]),'nonempty-list-of-exact-rational-expressions','list'],
      [list([list([])]),'nonempty-list-of-exact-rational-expressions','list']]],
  ];
  for(const [label,cases] of failures){
    for(const [input,expectedKind,actualKind] of cases){
      const before=JSON.stringify(input);
      const out=await evaluate(envelope,compileSelectedValueCall(envelope,ir(input),spec));
      check(out.status==='failure'&&out.code==='type-mismatch','controlled failure');
      const expected=diagnosticFromSpec(mismatchSpec,{operationId:'mean',argument:'data',
        expectedKinds:[expectedKind],actualKind});
      check(same(out.diagnostic,expected),'complete structured diagnostic through real Worker');
      check(JSON.stringify(input)===before,'rejected input unchanged');
    }
    results.push('PASS: '+label);
  }
  check(workerCalls.length===12&&workerCalls.every(id=>id===spec.evaluatorId),'all 12 requests used selected mean');
  window.s100bResult={pass:results.length,fail:0,todo:0,skip:0,requests:workerCalls.length,results};
}catch(error){
  window.s100bResult={pass:results.length,fail:1,todo:0,skip:0,results,error:String(error.stack??error)};
}finally{
  client.close();worker.terminate();
  document.getElementById('result').textContent=JSON.stringify(window.s100bResult,null,2);
}
