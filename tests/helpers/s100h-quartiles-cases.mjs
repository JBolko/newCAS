import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {integer,rational} from './s100e-statistics-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector,isValue,encodeValue,decodeValue} from '../../src/js/values/value.js';
import {renderSemanticCalculation} from '../../src/js/renderer.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ops=['quartiles','five_number_summary'];

export async function runQuartileCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100h'),results=[];
  const specs=sourceListSpecs();for(const op of [...ops,'median'])specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const run=(task='T')=>{
    const revision=`s100h-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(task,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  const expect=(qs,lo,hi)=>{
    for(const [id,nodes] of [['quartiles',qs],['five_number_summary',[lo,...qs,hi]]]){
      const actual=result(id);
      check(actual?.kind==='list'&&same(actual.data.items.map(v=>v.data.expr),nodes),`${id}: ${JSON.stringify(actual)}`);
      check(isValue(actual)&&same(decodeValue(encodeValue(actual)),actual),'P0005 list roundtrip '+id);
      check(Object.isFrozen(actual)&&Object.isFrozen(actual.data.items)&&actual.data.items.every(v=>Object.isFrozen(v)&&Object.isFrozen(v.data.expr)),'immutable returned list '+id);
    }
    check(same(result('consumer')?.data.expr,qs[1]),'returned quartiles reused as median input');
  };
  add('provider','n:=2');add('data','A:={n,4,n}');
  add('quartiles','Q:=quartiles(A)');add('five_number_summary','S:=five_number_summary(A)');
  add('consumer','median(Q)');
  await run();expect([integer('2'),integer('2'),integer('4')],integer('2'),integer('4'));
  const old=result('quartiles'),oldInput=result('data'),before=JSON.stringify([old,oldInput]);
  add('other-data','A:={100,200,300}','U');add('other','quartiles(A)','U');await run('U');
  check(same(result('other')?.data.items.map(v=>v.data.expr),[integer('100'),integer('200'),integer('300')]),'separate task provider');
  const otherCalculation=runtime.getBlock('other').calculation;
  runtime.setBlockSource('provider','n:=6');
  check([...ops,'consumer'].every(id=>runtime.getBlock(id).calculation.status==='dirty'),'provider invalidates quartiles, summary and dependent median');
  await run();expect([integer('4'),integer('6'),integer('6')],integer('4'),integer('6'));
  check(JSON.stringify([old,oldInput])===before,'old results and observation order unchanged');
  check(runtime.getBlock('other').calculation===otherCalculation,'task isolation after edit');
  results.push('provider binding, invalidation/recalculation, task isolation, immutable ListValue roundtrip and downstream reuse');

  for(const [source,qs,lo,hi] of [
    ['A:={1,2,3,4,5,6,7}',[integer('2'),integer('4'),integer('6')],integer('1'),integer('7')],
    ['A:={1,2,3,4,5,6,7,8}',[rational('5','2'),rational('9','2'),rational('13','2')],integer('1'),integer('8')],
    ['A:={9,1,7,3,5}',[integer('2'),integer('5'),integer('8')],integer('1'),integer('9')],
    ['A:={3,1,3,2}',[rational('3','2'),rational('5','2'),integer('3')],integer('1'),integer('3')],
    ['A:={2/3,1/3,1/2}',[rational('1','3'),rational('1','2'),rational('2','3')],rational('1','3'),rational('2','3')],
    ['A:={0.2,0.1}',[rational('1','10'),rational('3','20'),rational('1','5')],rational('1','10'),rational('1','5')],
    ['A:={-4,-1,-3,-2}',[rational('-7','2'),rational('-5','2'),rational('-3','2')],integer('-4'),integer('-1')],
    ['A:={9007199254740995,-9007199254740993,9007199254740993}',[integer('-9007199254740993'),integer('9007199254740993'),integer('9007199254740995')],integer('-9007199254740993'),integer('9007199254740995')],
    ['A:={9007199254740999,9007199254740993,9007199254740997,9007199254740995}',[integer('9007199254740994'),integer('9007199254740996'),integer('9007199254740998')],integer('9007199254740993'),integer('9007199254740999')],
    ['A:={-5/7}',[rational('-5','7'),rational('-5','7'),rational('-5','7')],rational('-5','7'),rational('-5','7')],
    ['A:={3,1}',[integer('1'),integer('2'),integer('3')],integer('1'),integer('3')],
    ['A:={3,1,2}',[integer('1'),integer('2'),integer('3')],integer('1'),integer('3')],
  ]){runtime.setBlockSource('data',source);await run();expect(qs,lo,hi);}
  results.push('n=1 approved repetition; n=2/3/7/8; center exclusion; unsorted/repeated, exact rational/decimal, negative and large source numbers');

  for(const op of ops){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'quartiles domain fixture',providers:[]};
    for(const input of [list([]),vector([expression(integer('1'))]),list([list([])]),list([expression({op:'approx',value:'0.1'})])]){
      const unchanged=JSON.stringify(input);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),[valueLiteral(input)]),specs.get(op)));
      check(out.status==='failure'&&same(out.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
        operationId:op,argument:'data',expectedKinds:[input.kind==='vector'?'list':'nonempty-list-of-exact-rational-expressions'],actualKind:input.kind}}),'structured '+op+' failure');
      check(JSON.stringify(input)===unchanged,'invalid input unchanged');
    }
  }
  runtime.setBlockSource('data','A:={}');await run();
  for(const op of ops){
    check(result(op)===null&&runtime.getBlock(op).calculation.status==='error','source failure clears '+op);
    check(same(runtime.getBlock(op).calculation.error?.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
      operationId:op,argument:'data',expectedKinds:['nonempty-list-of-exact-rational-expressions'],actualKind:'list'}}),'source diagnostic '+op);
  }
  check(result('consumer')===null&&runtime.getBlock('consumer').calculation.error?.code==='UPSTREAM_FAILED','dependent result cleared');
  runtime.setBlockSource('data','A:={7}');await run();expect([integer('7'),integer('7'),integer('7')],integer('7'),integer('7'));
  results.push('empty/vector/nested/approx diagnoses, source failure clears stale lists/dependents and singleton edit recovers');
  const output={textContent:''};renderSemanticCalculation(runtime.getBlock('quartiles').calculation,output);
  check(output.textContent==='PRESENTATION_UNSUPPORTED_VALUE','known list presentation gate unchanged');
  results.push('real Worker returns ordinary ListValues; selected renderer still reports its separate unsupported-list UI gate');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results,presentationGate:output.textContent};
}
