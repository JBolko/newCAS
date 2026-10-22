import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {integer,rational} from './s100e-statistics-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector,isValue,encodeValue,decodeValue} from '../../src/js/values/value.js';

export const frequencyOperations=['observation_values','absolute_frequencies','relative_frequencies',
  'cumulative_absolute_frequencies','cumulative_relative_frequencies'];
const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ints=values=>values.map(integer);

export async function runFrequencyCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100i'),results=[];
  const specs=sourceListSpecs();for(const op of frequencyOperations)specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const run=(task='T')=>{
    const revision=`s100i-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(task,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  const expect=expected=>frequencyOperations.forEach((op,index)=>{
    const value=result(op);
    check(value?.kind==='list'&&same(value.data.items.map(x=>x.data.expr),expected[index]),op+': '+JSON.stringify(value));
    check(isValue(value)&&same(decodeValue(encodeValue(value)),value),'Value roundtrip '+op);
    check(Object.isFrozen(value)&&Object.isFrozen(value.data.items)&&value.data.items.every(Object.isFrozen),'immutable output '+op);
  });
  add('n','n:=5');add('data','A:={n,2,n,3,2,n}');
  for(const op of frequencyOperations)add(op,`${op}(A)`);
  add('consumer','mean(relative_frequencies(A))');await run();
  expect([ints(['2','3','5']),ints(['2','1','3']),[rational('1','3'),rational('1','6'),rational('1','2')],
    ints(['2','3','6']),[rational('1','3'),rational('1','2'),integer('1')]]);
  check(same(result('consumer')?.data.expr,rational('1','3')),'frequency output reused as exact list');
  results.push('source reference: ordered distinct values, counts, exact frequencies and cumulative projections');
  const oldInput=result('data'),oldResult=result('relative_frequencies'),before=JSON.stringify([oldInput,oldResult]);
  add('other-data','A:={10}','U');add('other','relative_frequencies(A)','U');await run('U');
  const other=runtime.getBlock('other').calculation;
  runtime.setBlockSource('n','n:=2');
  check(frequencyOperations.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'provider invalidates projections');
  await run();
  expect([ints(['2','3']),ints(['5','1']),[rational('5','6'),rational('1','6')],ints(['5','6']),[rational('5','6'),integer('1')]]);
  check(same(result('consumer')?.data.expr,rational('1','2')),'dependent recomputation');
  check(JSON.stringify([oldInput,oldResult])===before&&Object.isFrozen(oldInput.data.items),'immutable original observations/results');
  check(runtime.getBlock('other').calculation===other,'task isolation');
  results.push('provider edit recomputes counts/frequencies and consumer; input/result immutability and task isolation');
  for(const [source,expected] of [
    ['A:={1/3,2/6,0.1}',[[rational('1','10'),rational('1','3')],ints(['1','2']),[rational('1','3'),rational('2','3')],ints(['1','3']),[rational('1','3'),integer('1')]]],
    ['A:={10,2,3,2}',[ints(['2','3','10']),ints(['2','1','1']),[rational('1','2'),rational('1','4'),rational('1','4')],ints(['2','3','4']),[rational('1','2'),rational('3','4'),integer('1')]]],
    ['A:={9007199254740993,0,-9007199254740993,9007199254740993}',[ints(['-9007199254740993','0','9007199254740993']),ints(['1','1','2']),[rational('1','4'),rational('1','4'),rational('1','2')],ints(['1','2','4']),[rational('1','4'),rational('1','2'),integer('1')]]],
    ['A:={-5/7}',[[rational('-5','7')],ints(['1']),ints(['1']),ints(['1']),ints(['1'])]],
  ]){runtime.setBlockSource('data',source);await run();expect(expected);}
  results.push('exact decimal/rational equality, numeric sorting, negative/zero/large integers and singleton');
  for(const op of frequencyOperations){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'frequency domain fixture',providers:[]};
    for(const input of [list([]),vector([expression(integer('1'))]),list([list([])]),list([expression({op:'approx',value:'0.1'})])]){
      const before=JSON.stringify(input);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),[valueLiteral(input)]),specs.get(op)));
      check(out.status==='failure'&&same(out.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{operationId:op,argument:'data',
        expectedKinds:[input.kind==='vector'?'list':'nonempty-list-of-exact-rational-expressions'],actualKind:input.kind}}),'structured rejection '+op);
      check(JSON.stringify(input)===before,'invalid input unchanged');
    }
  }
  runtime.setBlockSource('data','A:={}');await run();
  for(const op of frequencyOperations)check(result(op)===null&&runtime.getBlock(op).calculation.error?.diagnostic?.code==='type-mismatch','empty source clears '+op);
  runtime.setBlockSource('data','A:={2}');await run();expect([ints(['2']),ints(['1']),ints(['1']),ints(['1']),ints(['1'])]);
  results.push('empty/vector/nested/approx structured failures and recovery after source edit');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
