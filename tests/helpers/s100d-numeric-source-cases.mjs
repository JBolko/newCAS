import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression} from '../../src/js/values/value.js';

const check=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const integer=value=>({op:'integer',value});
const rational=(numerator,denominator)=>({op:'rational',numerator,denominator});
const digits='12345678901234567890123456789';
const long=rational(digits,'1'+'0'.repeat(digits.length));

export async function runNumericSourceCases(evaluateSelected){
  const runtime=DocumentRuntime.createSemantic('s100d'),specs=sourceListSpecs(),results=[];
  let epoch=0,requests=0;
  const add=(id,source)=>runtime.addBlock({id,type:'formula',source});
  const result=id=>runtime.getBlock(id).calculation.result;
  const evaluate=(env,selection)=>{requests++;return evaluateSelected(env,selection);};
  const run=()=>{
    const revision=`s100d-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask('default',{revision,getCurrentRevision:()=>revision,
      createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,evaluate})});
  };
  const cases=[
    ['9007199254740993',integer('9007199254740993')],
    ['-9007199254740993',integer('-9007199254740993')],
    ['0.1',rational('1','10')],['0.2',rational('1','5')],
    ['0.'+digits,long],['1/3',rational('1','3')],
    ['0.1+0.2',rational('3','10')],['9007199254740993+1',integer('9007199254740994')],
    ['0002.500',rational('5','2')],['-0.1',rational('-1','10')],
  ];
  cases.forEach(([source],index)=>{add(`x${index}`,`x${index}:=${source}`);add(`r${index}`,`x${index}+0`);});
  await run();
  cases.forEach(([source,expected],index)=>{
    check(same(result(`x${index}`)?.data.expr,expected),'exact source '+source);
    check(same(result(`r${index}`)?.data.expr,expected),'exact Worker roundtrip '+source);
  });
  results.push('large signed integers, exact decimals/rationals and scalar operations through real backend');

  add('bare','0.1+0.2');await run();
  check(same(result('bare')?.data.expr,rational('3','10')),'standalone scalar expression');
  add('data',`A:={9007199254740993,-9007199254740993,0.1,0.2,0.${digits},1/3}`);await run();
  check(same(result('data')?.data.items.map(v=>v.data.expr),cases.slice(0,6).map(c=>c[1])),'list preserves all exact numeric elements');
  add('bigData','B:={9007199254740993,9007199254740995}');add('bigMean','mean(B)');await run();
  check(same(result('bigMean')?.data.expr,integer('9007199254740994')),'source integer list mean never loses digits');
  results.push('standalone scalar and heterogeneous exact-number ListValue construction');

  add('p','p:=0.1');add('useP','p+0.2');await run();
  check(same(result('useP')?.data.expr,rational('3','10')),'decimal provider result');
  runtime.setBlockSource('p','p:=0.2');
  check(runtime.getBlock('useP').calculation.result===null,'numeric edit invalidates result');
  await run();check(same(result('useP')?.data.expr,rational('2','5')),'decimal source recomputation');
  add('f','f(t):=t+0.1');add('fUse','f(0.2)');await run();
  check(same(result('fUse')?.data.expr,rational('3','10')),'function arithmetic uses same rational leaves');
  results.push('exact decimal provider invalidation/recomputation and existing FunctionValue path');

  add('meanExact','mean(A)');await run();
  check(same(result('meanExact')?.data.expr,rational('227037036703703703670370370367','1800000000000000000000000000000')),'S100e mean accepts exact rational data without loss');
  const env={protocol:'newcas.semantic-evaluation.v1',revision:'approx-control',blockId:'approx',taskScopeId:'control',source:'materialized approx Value',providers:[]};
  const approx=expression({op:'approx',value:'0.1',precisionBits:53});
  const selected=compileSelectedValueCall(env,call(operationReference('add'),[valueLiteral(approx),valueLiteral(expression(integer('0')))]),specs.get('add'));
  const out=await evaluate(env,selected);
  check(out.status==='success'&&out.value.data.expr.op==='approx'&&out.value.data.expr.precisionBits===53,'existing approximate Value retains its approximation semantics');
  results.push('exact rational mean and explicit approx Value remain distinct from approximate statistics');
  return {pass:results.length,fail:0,todo:0,skip:0,requests,results};
}
