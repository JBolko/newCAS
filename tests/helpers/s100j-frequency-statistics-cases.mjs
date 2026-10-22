import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {integer,rational} from './s100e-statistics-cases.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression,list,vector,isValue,encodeValue,decodeValue} from '../../src/js/values/value.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ops=['mean','variance','standard_deviation','sample_variance','sample_standard_deviation',
  'median','min','max','quartiles','five_number_summary'];
const ints=values=>list(values.map(value=>expression(integer(value))));

export async function runFrequencyStatisticsCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100j'),results=[];
  const specs=sourceListSpecs();for(const op of ops)specs.set(op,findSelectedOperationSpec(op));
  let epoch=0,requests=0;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const result=id=>runtime.getBlock(id).calculation.result;
  const add=(id,source,taskId='T')=>runtime.addBlock({id,type:'formula',source,taskId});
  const run=(task='T')=>{
    const revision=`s100j-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(task,{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  const equivalent=()=>{
    for(const op of ops){
      const table=runtime.getBlock(op).calculation,raw=runtime.getBlock(`raw-${op}`).calculation;
      check(table.status===raw.status,'same outcome status '+op);
      if(table.status==='success'){
        check(same(table.result,raw.result),'table equals expanded test oracle '+op);
        check(isValue(table.result)&&same(decodeValue(encodeValue(table.result)),table.result),'Value roundtrip '+op);
        check(Object.isFrozen(table.result)&&!JSON.stringify(table.result).includes('"op":"approx"'),'immutable exact '+op);
        if(table.result.kind==='list')check(Object.isFrozen(table.result.data.items)&&table.result.data.items.every(Object.isFrozen),'frozen list elements '+op);
      }else{
        check(op.startsWith('sample_')&&table.result===null&&raw.result===null,'only singleton sample rejection');
        check(same(table.error?.diagnostic,{diagnosticVersion:1,code:'type-mismatch',parameters:{operationId:op,argument:'counts',
          expectedKinds:['absolute-frequencies-with-total-at-least-two'],actualKind:'list'}}),'structured table singleton '+op);
        check(raw.error?.diagnostic?.code==='type-mismatch'&&raw.error.diagnostic.parameters.argument==='data','structured raw singleton '+op);
      }
    }
  };
  add('n','n:=2');add('X','X:={n,3,5}');add('H','H:={2,1,3}');add('A','A:={n,n,3,5,5,5}');
  for(const op of ops){add(op,`${op}(X,H)`);add(`raw-${op}`,`${op}(A)`);}
  add('consumer','median(quartiles(X,H))');await run();equivalent();
  check(same(result('mean')?.data.expr,rational('11','3')),'reference mean 11/3');
  check(same(result('variance')?.data.expr,rational('17','9')),'reference population variance');
  check(same(result('sample_variance')?.data.expr,rational('34','15')),'reference sample variance');
  check(same(result('quartiles'),ints(['2','4','5']))&&same(result('five_number_summary'),ints(['2','2','4','5','5'])),'reference order statistics');
  check(same(result('consumer')?.data.expr,integer('4')),'returned list reused');
  results.push('all ten table operations equal raw observations; reference mean 11/3, exact roots and list output reuse');

  const previous=[result('X'),result('H'),result('quartiles')],unchanged=JSON.stringify(previous);
  add('other-X','X:={100}','U');add('other-H','H:={2}','U');add('other','mean(X,H)','U');await run('U');
  check(same(result('other')?.data.expr,integer('100')),'isolated table task result');
  const other=runtime.getBlock('other').calculation;
  runtime.setBlockSource('n','n:=4');
  check(ops.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'X provider invalidates statistics');
  await run();equivalent();check(same(result('mean')?.data.expr,rational('13','3')),'edited X provider mean');
  runtime.setBlockSource('H','H:={0,1,1}');runtime.setBlockSource('A','A:={3,5}');
  check(ops.every(op=>runtime.getBlock(op).calculation.status==='dirty'),'H edit invalidates statistics');
  await run();equivalent();check(same(result('min')?.data.expr,integer('3')),'zero count excludes actual extrema');
  check(JSON.stringify(previous)===unchanged&&previous.every(Object.isFrozen),'old input and result values unchanged');
  check(runtime.getBlock('other').calculation===other,'task isolation');
  results.push('both X/provider and H edits invalidate and recalculate; zero counts, immutable earlier inputs/results, task isolation');

  for(const [X,H,A] of [
    ['{99,0.1,0.2}','{0,1,1}','{0.1,0.2}'],
    ['{99,2,1,2}','{0,2,1,3}','{2,2,1,2,2,2}'],
    ['{3,1,2}','{1,1,1}','{3,1,2}'],
    ['{1,2,3,4,5,6,7}','{1,1,1,1,1,1,1}','{1,2,3,4,5,6,7}'],
    ['{1,2,3,4,5,6,7,8}','{1,1,1,1,1,1,1,1}','{1,2,3,4,5,6,7,8}'],
    ['{-9007199254740993,9007199254740993}','{1,1}','{-9007199254740993,9007199254740993}'],
  ]){
    runtime.setBlockSource('X',`X:=${X}`);runtime.setBlockSource('H',`H:=${H}`);runtime.setBlockSource('A',`A:=${A}`);
    await run();equivalent();
  }
  // Bounded expansion is only a source-fixture oracle; the production path never expands counts.
  for(let n=1;n<=9;n++){
    runtime.setBlockSource('X','X:={7}');runtime.setBlockSource('H',`H:={${n}}`);
    runtime.setBlockSource('A',`A:={${Array(n).fill('7').join(',')}}`);await run();equivalent();
  }
  results.push('small expandable table/raw equality: rational/decimal, duplicate/zero rows, negatives/large values and n=1..9 quartile/sample conventions');

  runtime.setBlockSource('X','X:={0,2}');runtime.setBlockSource('H','H:={9007199254740993,9007199254740993}');
  add('sample-square','sample_standard_deviation(X,H)^2');await run();
  for(const op of ['mean','variance','standard_deviation','median'])check(same(result(op)?.data.expr,integer('1')),'huge counts '+op);
  check(same(result('sample_variance')?.data.expr,rational('18014398509481986','18014398509481985')),'exact huge sample divisor');
  check(same(result('sample-square'),result('sample_variance')),'huge exact sample root squared');
  check(same(result('quartiles'),ints(['0','1','2']))&&same(result('five_number_summary'),ints(['0','0','1','2','2'])),'huge even rank boundaries');
  runtime.setBlockSource('X','X:={20,10,0}');runtime.setBlockSource('H','H:={9007199254740993,1,9007199254740993}');await run();
  check(same(result('median')?.data.expr,integer('10'))&&same(result('quartiles'),ints(['0','10','20'])),'huge odd ranks exclude center');
  runtime.setBlockSource('X','X:={0,2,4}');runtime.setBlockSource('H','H:={9007199254740993,9007199254740993,18014398509481986}');await run();
  check(same(result('median')?.data.expr,integer('3'))&&same(result('quartiles'),ints(['1','3','4'])),'huge Q1/Q2 average across cumulative rank boundaries');
  results.push('counts above Number safe range through source/Worker, exact sample divisor/root and even/odd cumulative rank lookup without expansion');

  for(const op of ops){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`bad-${op}`,blockId:'bad',taskScopeId:'invalid',source:'absolute frequency domain fixture',providers:[]};
    const badCases=[
      [[ints(['1']),ints(['-1'])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[ints(['1']),list([expression(rational('1','2'))])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[ints(['1']),list([expression({op:'approx',value:'1'})])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[ints(['1']),list([list([])])],'type-mismatch',{argument:'counts',expectedKinds:['list-of-exact-nonnegative-integers'],actualKind:'list'}],
      [[ints(['1']),ints(['0'])],'type-mismatch',{argument:'counts',expectedKinds:['absolute-frequencies-with-positive-total'],actualKind:'list'}],
      [[ints(['1']),vector([expression(integer('1'))])],'type-mismatch',{argument:'counts',expectedKinds:['list'],actualKind:'vector'}],
      [[ints(['1','2']),ints(['1'])],'dimension-mismatch',{expectedDimension:{items:2},actualDimension:{items:1}}],
    ];
    for(const [inputs,code,parameters] of badCases){
      const before=JSON.stringify(inputs);
      const out=await evaluate(env,compileSelectedValueCall(env,call(operationReference(op),inputs.map(valueLiteral)),specs.get(op)));
      check(out.status==='failure'&&same(out.diagnostic,{diagnosticVersion:1,code,parameters:{operationId:op,...parameters}}),'table domain diagnostic '+op);
      check(JSON.stringify(inputs)===before,'invalid tables unchanged');
    }
  }
  runtime.setBlockSource('H','H:={0,0,0}');await run();
  check(ops.every(op=>result(op)===null&&runtime.getBlock(op).calculation.error?.diagnostic?.code==='type-mismatch'),'zero total clears stale table results');
  check(result('consumer')===null,'dependent cleared after frequency error');
  runtime.setBlockSource('X','X:={20,10,0}');runtime.setBlockSource('H','H:={1,0,0}');runtime.setBlockSource('A','A:={20}');await run();equivalent();
  check(same(result('quartiles'),ints(['20','20','20']))&&same(result('five_number_summary'),ints(['20','20','20','20','20'])),'singleton recovery and approved repetition');
  results.push('all ten operations reject negative/fractional/approx/nested/vector counts, zero totals and unequal dimensions; source failure clears/recovery');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
