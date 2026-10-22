import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {integer,rational} from './s100e-statistics-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector} from '../../src/js/values/value.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ops=['median','min','max'];

export async function runOrderStatisticsCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100g'),results=[];
  const specs=sourceListSpecs();for(const op of ops)specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const run=(task='T')=>{
    const revision=`s100g-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(task,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  const expect=values=>ops.forEach((op,i)=>check(same(result(op)?.data.expr,values[i]),`${op}: ${JSON.stringify(result(op))}`));
  add('data','A:={1,3,5}');for(const op of ops)add(op,`${op}(A)`);
  await run();expect([integer('3'),integer('1'),integer('5')]);
  for(const [source,values] of [
    ['A:={1,2,3,4}',[rational('5','2'),integer('1'),integer('4')]],
    ['A:={3,1,3,2}',[rational('5','2'),integer('1'),integer('3')]],
    ['A:={3,1,2}',[integer('2'),integer('1'),integer('3')]],
    ['A:={10,2,3}',[integer('3'),integer('2'),integer('10')]],
    ['A:={2/3,1/3,1/2}',[rational('1','2'),rational('1','3'),rational('2','3')]],
    ['A:={0.2,0.1}',[rational('3','20'),rational('1','10'),rational('1','5')]],
    ['A:={-2,4,4}',[integer('4'),integer('-2'),integer('4')]],
    ['A:={9007199254740995,-9007199254740993,9007199254740993}',[integer('9007199254740993'),integer('-9007199254740993'),integer('9007199254740995')]],
    ['A:={-5/7}',[rational('-5','7'),rational('-5','7'),rational('-5','7')]],
  ]){runtime.setBlockSource('data',source);await run();expect(values);}
  results.push('odd/even, unsorted/repeated, numeric order, rational/decimal, negative/large and singleton source cases');

  // A separate task owns its own provider A and must survive all T edits.
  add('other-data','A:={100,200,300}','U');add('other','median(A)','U');
  await run('U');check(same(result('other')?.data.expr,integer('200')),'task U result');
  const otherCalculation=runtime.getBlock('other').calculation;
  // Put the variable before A so DocumentRuntime, rather than the Worker, resolves it.
  add('provider','n:=2','V');add('variable-data','B:={n,4,n}','V');
  for(const op of ops)add(`v-${op}`,`${op}(B)`,'V');
  await run('V');check(same(result('v-median')?.data.expr,integer('2')),'provider initial median');
  const old=result('variable-data'),before=JSON.stringify(old);
  check(same(old.data.items.map(x=>x.data.expr),[integer('2'),integer('4'),integer('2')]),'source order/repeats');
  runtime.setBlockSource('provider','n:=6');
  check(ops.every(op=>runtime.getBlock(`v-${op}`).calculation.status==='dirty'),'provider invalidation');
  await run('V');
  for(const [op,value] of [['median','6'],['min','4'],['max','6']])check(same(result(`v-${op}`)?.data.expr,integer(value)),'provider recalculation '+op);
  check(JSON.stringify(old)===before&&Object.isFrozen(old.data.items)&&old.data.items.every(Object.isFrozen),'immutable original list');
  check(runtime.getBlock('other').calculation===otherCalculation,'task-isolated calculation');
  results.push('document provider binding, ordered immutable observations, invalidation, recomputation and task isolation');

  for(const op of ops){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'order statistics domain fixture',providers:[]};
    for(const input of [list([]),vector([expression(integer('1'))]),list([list([])]),list([expression({op:'approx',value:'0.1'})])]){
      const unchanged=JSON.stringify(input);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),[valueLiteral(input)]),specs.get(op)));
      check(out.status==='failure'&&same(out.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
        operationId:op,argument:'data',expectedKinds:[input.kind==='vector'?'list':'nonempty-list-of-exact-rational-expressions'],actualKind:input.kind}}),'structured '+op+' failure');
      check(JSON.stringify(input)===unchanged,'invalid input unchanged');
    }
  }
  results.push('real Worker rejects empty, vector, nested list and approx with full P0009 facts');
  runtime.setBlockSource('data','A:={}');await run();
  for(const op of ops){
    check(result(op)===null&&runtime.getBlock(op).calculation.status==='error','source error clears '+op);
    check(same(runtime.getBlock(op).calculation.error?.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{
      operationId:op,argument:'data',expectedKinds:['nonempty-list-of-exact-rational-expressions'],actualKind:'list'}}),'source diagnostic '+op);
  }
  runtime.setBlockSource('data','A:={4,2}');await run();expect([integer('3'),integer('2'),integer('4')]);
  results.push('empty source clears stale results with structured diagnostics; subsequent edit recovers');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
