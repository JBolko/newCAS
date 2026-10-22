import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {isValue} from '../../src/js/values/value.js';

export const sourceListSpecs=()=>new Map([
  ...['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,
    evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]),
  ...['list','mean'].map(id=>[id,findSelectedOperationSpec(id)]),
]);
const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export async function runSourceListCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100c'),results=[],calls=[];
  let epoch=0;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const calc=id=>runtime.getBlock(id).calculation;
  const number=id=>calc(id).result?.data?.expr?.value;
  const items=id=>calc(id).result?.data?.items.map(v=>v.data.expr.value);
  async function run(taskId='T'){
    const revision=`s100c-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(taskId,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({
        snapshot,parse,specs:sourceListSpecs(),revision,cachedOutcomes,
        evaluate:(env,selection)=>{calls.push([env.blockId,selection.evaluationRequest.evaluatorId]);return evaluateSelected(env,selection);},
      })});
  }
  add('A','A:={2,4,6,8}'); add('mean','mean(A)');
  check((await run()).kind==='complete'&&number('mean')==='5','source list mean=5');
  check(same(items('A'),['2','4','6','8']),'ordered actual ListValue');
  check(isValue(calc('A').result)&&calc('A').result.kind==='list','frozen ListValue');
  results.push('source literal list -> IR -> Worker -> mean=5');

  runtime.setBlockSource('A','A:={1,2,4}');
  check(calc('mean').status==='dirty'&&calc('mean').result===null,'source edit invalidates result');
  await run();
  check(same(calc('mean').result.data.expr,{op:'rational',numerator:'7',denominator:'3'}),'recomputed exact 7/3');
  results.push('list source edit invalidates and recomputes exact 7/3');

  add('n','n:=2','U'); add('B','A:={n,4,n}','U'); add('useB','mean(A)','U');
  const snapshot=runtime.deriveSemanticTask('U');
  check(snapshot.analysis.bindings.get('B').get('n')==='n','list references bind provider n');
  check(snapshot.analysis.bindings.get('useB').get('A')==='B','mean binds task-local list');
  await run('U'); check(same(items('B'),['2','4','2']),'references preserve repeats/order');
  check(same(calc('useB').result.data.expr,{op:'rational',numerator:'8',denominator:'3'}),'bound mean=8/3');
  const other=calc('mean').result;
  runtime.setBlockSource('n','n:=4');
  check(calc('B').status==='dirty'&&calc('useB').status==='dirty','provider edit invalidates list and mean');
  await run('U'); check(same(items('B'),['4','4','4'])&&number('useB')==='4','provider recomputation');
  check(calc('mean').result===other,'other task unchanged');
  results.push('provider identity, repetition, task isolation and downstream recalculation');

  runtime.setBlockSource('B','A:={n+2,n*3,-n}'); await run('U');
  check(same(items('B'),['6','12','-4']),'element expressions evaluated in order');
  check(same(calc('useB').result.data.expr,{op:'rational',numerator:'14',denominator:'3'}),'expression mean=14/3');
  runtime.setBlockSource('n','n:='); await run('U');
  check(calc('B').result===null&&calc('useB').result===null,'failed provider never reuses old list or mean');
  runtime.setBlockSource('n','n:=4'); await run('U');
  const usePosition=runtime.getBlocks().findIndex(b=>b.id==='useB');
  runtime.insertBlock({id:'laterN',type:'formula',source:'n:=99',taskId:'U'},usePosition);
  await run('U');
  check(runtime.deriveSemanticTask('U').analysis.bindings.get('B').get('n')==='n','later definition does not rebind earlier list elements');
  check(same(items('B'),['6','12','-4']),'later n does not change materialized list');
  results.push('integer element expressions; failed provider has no previous-result fallback');

  add('isolated','A:={n,4,n}','V'); add('useIsolated','mean(A)','V'); await run('V');
  check(calc('isolated').status==='error'&&calc('useIsolated').result===null,'no cross-task provider leak');
  add('vector','A:=[2,4]','W');add('vectorUse','mean(A)','W');await run('W');
  check(calc('vector').result===null&&calc('vectorUse').result===null,'Vector AST never converted to list');
  add('empty','A:={}','E');add('emptyUse','mean(A)','E');await run('E');
  check(calc('empty').result?.kind==='list'&&calc('empty').result.data.items.length===0,'empty list constructor');
  check(calc('emptyUse').status==='error'&&calc('emptyUse').result===null,'empty mean rejected');
  results.push('unresolved task reference, vector and empty mean fail without conversion/fallback');
  return {pass:results.length,fail:0,todo:0,skip:0,results,requests:calls.length,calls};
}
