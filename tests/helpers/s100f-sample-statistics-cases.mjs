import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {integer,rational,populationRoot} from './s100e-statistics-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector} from '../../src/js/values/value.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sqrt2={op:'pow',base:integer('2'),exponent:rational('1','2')};
const sampleRoot={op:'mul',args:[rational('1','20'),sqrt2]};

export async function runSampleStatisticsCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100f'),results=[],ops=['variance','standard_deviation','sample_variance','sample_standard_deviation'];
  const specs=sourceListSpecs();for(const op of ops)specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source)=>runtime.addBlock({id,type:'formula',source});
  const run=()=>{
    const revision=`s100f-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask('default',{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  add('n','n:=0.1');add('data','A:={n,0.2}');
  for(const op of ops)add(op,`${op}(A)`);
  await run();
  for(const [op,expected] of [['variance',rational('1','400')],['standard_deviation',rational('1','20')],['sample_variance',rational('1','200')],['sample_standard_deviation',sampleRoot]])
    check(same(result(op)?.data.expr,expected),'exact decimal '+op);
  const old=result('data'),before=JSON.stringify(old);
  results.push('two exact decimal observations: sample variance 1/200 and std sqrt(2)/20');

  runtime.setBlockSource('n','n:=0.3');
  check(ops.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'provider edit invalidates every statistic');
  await run();check(same(result('sample_standard_deviation')?.data.expr,sampleRoot),'provider re-evaluation');
  runtime.setBlockSource('data','A:={1,2,3}');await run();
  check(same(result('sample_variance')?.data.expr,integer('1'))&&same(result('sample_standard_deviation')?.data.expr,integer('1')),'sample divisor n-1');
  check(same(result('variance')?.data.expr,rational('2','3'))&&same(result('standard_deviation')?.data.expr,populationRoot),'population divisor unchanged');
  results.push('source/provider edits recalculate; sample 1/1 stays distinct from population 2/3 and sqrt(2/3)');

  runtime.setBlockSource('data','A:={9007199254740993,9007199254740995}');await run();
  check(same(result('sample_variance')?.data.expr,integer('2'))&&same(result('sample_standard_deviation')?.data.expr,sqrt2),'large integer sample without Number loss');
  check(JSON.stringify(old)===before&&Object.isFrozen(old.data.items),'old observations unchanged');
  runtime.setBlockSource('data','A:={5/7}');await run();
  check(['sample_variance','sample_standard_deviation'].every(op=>runtime.getBlock(op).calculation.status==='error'&&result(op)===null),'singleton clears old sample results');
  for(const op of ['sample_variance','sample_standard_deviation'])
    check(same(runtime.getBlock(op).calculation.error?.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
      operationId:op,argument:'data',expectedKinds:['list-of-at-least-two-exact-rational-expressions'],actualKind:'list'}}),'singleton source retains structured diagnostic');
  check(same(result('variance')?.data.expr,integer('0'))&&same(result('standard_deviation')?.data.expr,integer('0')),'singleton population still zero');
  results.push('large integer exactness, immutable input and singleton sample failure with population zero');

  for(const op of ['sample_variance','sample_standard_deviation']){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'sample domain fixture',providers:[]};
    for(const input of [list([]),list([expression(integer('1'))]),vector([expression(integer('1')),expression(integer('2'))]),
      list([list([]),expression(integer('1'))]),list([expression(integer('1')),expression({op:'approx',value:'0.2'})])]){
      const unchanged=JSON.stringify(input);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),[valueLiteral(input)]),specs.get(op)));
      const expected=input.kind==='vector'?'list':'list-of-at-least-two-exact-rational-expressions';
      check(out.status==='failure'&&same(out.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
        operationId:op,argument:'data',expectedKinds:[expected],actualKind:input.kind}}),'structured '+op+' failure');
      check(JSON.stringify(input)===unchanged,'invalid sample input unchanged');
    }
  }
  results.push('empty, singleton, vector, nested list and approx controlled diagnoses');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
