import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {integer,rational} from './s100e-statistics-cases.mjs';
import {frequencyOperations} from './s100i-frequency-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector,isValue,encodeValue,decodeValue} from '../../src/js/values/value.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ints=values=>list(values.map(value=>expression(integer(value))));

export async function runFrequencyTableProjectionCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100k'),results=[];
  const specs=sourceListSpecs();for(const op of frequencyOperations)specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const run=(task='T')=>{
    const revision=`s100k-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(task,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  const equivalent=()=>frequencyOperations.forEach(op=>{
    const value=result(op);
    check(value?.kind==='list'&&same(value,result(`raw-${op}`)),'table equals small raw reference '+op);
    check(isValue(value)&&same(decodeValue(encodeValue(value)),value),'Value roundtrip '+op);
    check(Object.isFrozen(value)&&Object.isFrozen(value.data.items)&&value.data.items.every(Object.isFrozen),'immutable result '+op);
  });
  const expect=expected=>frequencyOperations.forEach((op,index)=>check(same(result(op)?.data.items.map(x=>x.data.expr),expected[index]),op+': '+JSON.stringify(result(op))));
  add('n','n:=5');add('X','X:={n,2,3,2}');add('H','H:={3,1,0,1}');add('A','A:={n,n,n,2,2}');
  for(const op of frequencyOperations){add(op,`${op}(X,H)`);add(`raw-${op}`,`${op}(A)`);}
  add('consumer','mean(relative_frequencies(X,H))');await run();equivalent();
  expect([[integer('2'),integer('5')],[integer('2'),integer('3')],[rational('2','5'),rational('3','5')],
    [integer('2'),integer('5')],[rational('2','5'),integer('1')]]);
  check(same(result('consumer')?.data.expr,rational('1','2')),'projection reused as ordinary exact list');
  results.push('all five raw/binary projections, zero rows and duplicates; exact reference 2/5,3/5 and downstream reuse');

  const old=[result('X'),result('H'),result('relative_frequencies')],before=JSON.stringify(old);
  add('other-X','X:={99}','U');add('other-H','H:={2}','U');add('other','absolute_frequencies(X,H)','U');await run('U');
  check(same(result('other'),ints(['2'])),'isolated task result');
  const other=runtime.getBlock('other').calculation;
  runtime.setBlockSource('n','n:=10');
  check(frequencyOperations.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'X provider invalidates');
  await run();equivalent();check(same(result('observation_values'),ints(['2','10'])),'X provider recomputation');
  runtime.setBlockSource('H','H:={1,0,2,0}');runtime.setBlockSource('A','A:={10,3,3}');
  check(frequencyOperations.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'H invalidates');
  await run();equivalent();check(same(result('absolute_frequencies'),ints(['2','1'])),'H recomputation');
  check(JSON.stringify(old)===before&&old.every(Object.isFrozen),'old observations/counts/results unchanged');
  check(runtime.getBlock('other').calculation===other,'task isolation');
  for(const [X,H,A] of [
    ['{0.1,-1/3,5,-2/6}','{2,1,0,2}','{0.1,0.1,-1/3,-1/3,-1/3}'],
    ['{10,2,3}','{1,2,1}','{10,2,2,3}'],
    ['{-5/7,99}','{1,0}','{-5/7}'],
  ]){
    runtime.setBlockSource('X',`X:=${X}`);runtime.setBlockSource('H',`H:=${H}`);runtime.setBlockSource('A',`A:=${A}`);await run();equivalent();
  }
  results.push('both providers edited/reactively recalculated, isolated tasks, immutable values, rational/decimal equality, numeric order and singleton');

  runtime.setBlockSource('X','X:={9007199254740993,-9007199254740993,0,-9007199254740993}');
  runtime.setBlockSource('H','H:={27021597764222979,9007199254740993,0,9007199254740993}');await run();
  expect([[integer('-9007199254740993'),integer('9007199254740993')],[integer('18014398509481986'),integer('27021597764222979')],
    [rational('2','5'),rational('3','5')],[integer('18014398509481986'),integer('45035996273704965')],[rational('2','5'),integer('1')]]);
  results.push('source values and counts above 2^53 exact through real Worker; cumulative N=45035996273704965 without expansion');

  for(const op of frequencyOperations){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'table projection domain fixture',providers:[]};
    const cases=[
      [[list([]),list([])],'type-mismatch',{argument:'counts',expectedKinds:['absolute-frequencies-with-positive-total'],actualKind:'list'}],
      [[ints(['1']),ints(['-1'])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[ints(['1']),list([expression(rational('1','2'))])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[ints(['1']),list([expression({op:'approx',value:'1'})])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[vector([expression(integer('1'))]),ints(['1'])],'type-mismatch',{argument:'values',expectedKinds:['list'],actualKind:'vector'}],
      [[ints(['1']),vector([expression(integer('1'))])],'type-mismatch',{argument:'counts',expectedKinds:['list'],actualKind:'vector'}],
      [[list([expression({op:'approx',value:'1'}),expression(integer('2'))]),ints(['0','1'])],'type-mismatch',{argument:'values',expectedKinds:['nonempty-list-of-exact-rational-expressions'],actualKind:'list'}],
    ];
    for(const [inputs,code,parameters] of cases){
      const unchanged=JSON.stringify(inputs);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),inputs.map(valueLiteral)),specs.get(op)));
      check(out.status==='failure'&&same(out.diagnostic,{diagnosticVersion:1,code,parameters:{operationId:op,...parameters}}),'full Worker diagnostic '+op);
      check(JSON.stringify(inputs)===unchanged,'invalid input unchanged');
    }
  }
  for(const [X,H,code,parameters] of [
    ['{{1},2}','{0,1}','type-mismatch',{argument:'values',expectedKinds:['nonempty-list-of-exact-rational-expressions'],actualKind:'list'}],
    ['{1,2}','{-1,2}','type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
    ['{1,2}','{1}','dimension-mismatch',{expectedDimension:{items:2},actualDimension:{items:1}}],
    ['{1,2}','{0,0}','type-mismatch',{argument:'counts',expectedKinds:['absolute-frequencies-with-positive-total'],actualKind:'list'}],
  ]){
    runtime.setBlockSource('X',`X:=${X}`);runtime.setBlockSource('H',`H:=${H}`);await run();
    for(const op of frequencyOperations)check(result(op)===null&&same(runtime.getBlock(op).calculation.error?.diagnostic,
      {diagnosticVersion:1,code,parameters:{operationId:op,...parameters}}),'DocumentRuntime retains full diagnostic '+op);
    check(result('consumer')===null,'failed source clears consumer');
  }
  runtime.setBlockSource('X','X:={-5/7,99}');runtime.setBlockSource('H','H:={1,0}');runtime.setBlockSource('A','A:={-5/7}');await run();equivalent();
  results.push('both arguments/zero counts/approx/vector/dimensions/total have full P0009 facts through Worker and DocumentRuntime; source recovery');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
