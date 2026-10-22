import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector,isValue,encodeValue,decodeValue} from '../../src/js/values/value.js';
import {evaluationSuccess,isEvaluationOutcome} from '../../src/js/evaluator/evaluation-contract.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const integer=value=>({op:'integer',value});
export const rational=(numerator,denominator)=>({op:'rational',numerator,denominator});
export const populationRoot={op:'mul',args:[rational('1','3'),{
  op:'pow',base:integer('6'),exponent:rational('1','2')}]};

export async function proveExactRootTransport(evaluate){
  const spec=operationSpec({operationId:'power',evaluatorId:'probe.scalar.power',
    arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]});
  const env={protocol:'newcas.semantic-evaluation.v1',revision:'root-gate',blockId:'root',
    taskScopeId:'root-gate',source:'materialized root preflight',providers:[]};
  const ir=call(operationReference('power'),[valueLiteral(expression(rational('2','3'))),valueLiteral(expression(rational('1','2')))]);
  const out=await evaluate(env,compileSelectedValueCall(env,ir,spec));
  check(out.status==='success'&&same(out.value,expression(populationRoot)),'existing Worker returns exact sqrt(2/3)');
  check(isValue(out.value)&&isEvaluationOutcome(evaluationSuccess(out.value)),'irrational expression fits P0005/P0010');
  check(same(decodeValue(encodeValue(out.value)),out.value),'irrational transport roundtrip');
  return 'existing power/adapter/Value/P0010 supports exact nonnegative sqrt(2/3)';
}

export async function runPopulationStatisticsCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100e'),results=[],ops=['mean','variance','standard_deviation'];
  const specs=sourceListSpecs();for(const op of ops)specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const run=(taskId='T')=>{
    const revision=`s100e-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(taskId,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  add('n','n:=0.1');add('data','A:={n,0.2}');
  for(const op of ops)add(op,`${op}(A)`);
  add('rationalMean','mean({1/3,2/3})');
  await run();
  for(const [op,expected] of [['mean',rational('3','20')],['variance',rational('1','400')],['standard_deviation',rational('1','20')],['rationalMean',rational('1','2')]])
    check(same(result(op)?.data.expr,expected),'exact result '+op);
  const old=result('data'),before=JSON.stringify(old);
  check(isValue(old)&&Object.isFrozen(old.data.items),'immutable observations');
  results.push('rational/decimal mean and exact population variance/std');

  add('otherA','A:={9,9}','U');add('otherVar','variance(A)','U');await run('U');
  const other=result('otherVar');
  runtime.setBlockSource('n','n:=0.3');
  check(ops.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'provider change invalidates statistics');
  await run();check(same(result('mean')?.data.expr,rational('1','4')),'exact recomputed mean');
  check(same(result('variance')?.data.expr,rational('1','400')),'exact recomputed variance');
  check(JSON.stringify(old)===before&&result('otherVar')===other,'input and other task unchanged');
  results.push('provider edit, immutable previous Value and task isolation');

  runtime.setBlockSource('data','A:={1,2,3}');await run();
  check(same(result('mean')?.data.expr,integer('2')),'integer mean');
  check(same(result('variance')?.data.expr,rational('2','3')),'population divisor n');
  check(same(result('standard_deviation')?.data.expr,populationRoot),'exact irrational std, no float');
  runtime.setBlockSource('data','A:={5/7}');await run();
  check(same(result('variance')?.data.expr,integer('0'))&&same(result('standard_deviation')?.data.expr,integer('0')),'singleton population spread is zero');
  results.push('dataset edit, exact irrational square root, singleton zero');

  for(const op of ops){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'materialized invalid fixture',providers:[]};
    for(const [input,expectedKind,actualKind] of [
      [list([]),'nonempty-list-of-exact-rational-expressions','list'],
      [vector([expression(integer('1'))]),'list','vector'],
      [list([list([])]),'nonempty-list-of-exact-rational-expressions','list'],
      [list([expression({op:'approx',value:'0.1',precisionBits:53})]),'nonempty-list-of-exact-rational-expressions','list'],
    ]){
      const unchanged=JSON.stringify(input);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),[valueLiteral(input)]),specs.get(op)));
      check(out.status==='failure'&&out.code==='type-mismatch','controlled '+op+' failure');
      check(same(out.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{operationId:op,argument:'data',expectedKinds:[expectedKind],actualKind}}),'complete '+op+' diagnostic');
      check(JSON.stringify(input)===unchanged,'invalid input unchanged');
    }
  }
  results.push('empty, vector, nested list and approx rejected by every population operation');
  add('emptySource','variance({})');await run();
  check(same(runtime.getBlock('emptySource').calculation.error?.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
    operationId:'variance',argument:'data',expectedKinds:['nonempty-list-of-exact-rational-expressions'],actualKind:'list'}}),'source failure retains structured diagnostic in DocumentRuntime');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
