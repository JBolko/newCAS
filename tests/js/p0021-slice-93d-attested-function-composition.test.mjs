/** P0021 S93d — mandatory GREEN regression for S93c composed function pressure.
 * All function calls are resolved by P0020's positional attestation, not by names
 * inside the materializer, and never by Python code generation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression, encodeValue, decodeValue} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {providerReference, valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {freeSymbolIdentity} from '../../src/js/semantics/identity.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`s93d.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
const leaf=async(_envelope,selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const op=selected.evaluationRequest.evaluatorId;
  return {blockId:selected.blockId,status:'success',
    value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
function fixture(entries) {
  const rt=new DocumentRuntime({calculate:async()=>{throw Error('LEGACY_ENGINE_FORBIDDEN');}},'s93d');
  for(const [id,source] of entries)rt.addBlock({id,type:'formula',source,taskId:'default'});
  return rt;
}
async function run(rt,revision='s93d-r1') {
  const {snapshot}=rt.deriveSemanticTask();
  await rt.evaluateAndCommitSemanticTask('default',{revision,getCurrentRevision:()=>revision,
    evaluate:createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:leaf,revision})});
}
const result=(rt,id)=>rt.getBlock(id).calculation;
const number=(rt,id)=>result(rt,id).result?.data?.expr?.value??null;

// Promote all three S93c pressure cases to mandatory Node auto-discovery.
test('S93d: a function body calls a prior attested FunctionValue',async()=>{
  const rt=fixture([['f','f(x):=x+1'],['g','g(x):=f(x)*2'],['out','g(3)']]);
  await run(rt);
  assert.equal(number(rt,'out'),'8');
});

test('S93d: chained calls retain captured scalars and local binders',async()=>{
  const rt=fixture([['a','a:=2'],['f','f(x):=a*x+1'],['g','g(x):=f(x)+f(1)'],['out','g(3)']]);
  await run(rt);
  assert.equal(number(rt,'out'),'10');
});

test('S93d: later redefinition cannot rebind an earlier function body',async()=>{
  const rt=fixture([['f1','f(x):=x+1'],['g','g(x):=f(x)*2'],['f2','f(x):=100x'],['out','g(3)']]);
  await run(rt);
  assert.equal(number(rt,'out'),'8');
});

test('S93d: call to a future function is not silently rebound',async()=>{
  const rt=fixture([['g','g(x):=f(x)*2'],['f','f(x):=x+1'],['out','g(3)']]);
  await run(rt);
  assert.notEqual(result(rt,'g').status,'success');
  assert.notEqual(result(rt,'out').status,'success');
});

test('S93d: scalar writer is not an implicitly callable function',async()=>{
  const rt=fixture([['a','a:=3'],['g','g(x):=a(x)+1'],['out','g(2)']]);
  await run(rt);
  assert.notEqual(result(rt,'g').status,'success');
  assert.notEqual(result(rt,'out').status,'success');
});

test('S93d: wrong function arity fails closed',async()=>{
  const rt=fixture([['f','f(x):=x+1'],['g','g(x):=f(x;1)+1'],['out','g(3)']]);
  await run(rt);
  assert.notEqual(result(rt,'g').status,'success');
});

test('S93d: compiler cannot guess source call provider names',()=>{
  const ast=parse('f(x)')[0];
  const resolveVariable=()=>providerReference('x-provider');
  assert.throws(()=>compileSelectedSourceAst(ast,{specs,resolveVariable}),/unselected operation/);
  assert.throws(()=>compileSelectedSourceAst(ast,{specs,resolveVariable,
    resolveCallable:()=>valueLiteral(integer(2))}),/attested provider-reference/);
  const ir=compileSelectedSourceAst(ast,{specs,resolveVariable,
    resolveCallable:name=>name==='f'?providerReference('writer-f'):null});
  assert.equal(ir.callee.kind,'provider-reference');
  assert.equal(ir.callee.providerId,'writer-f');
});

test('S93d: materializer requires an explicit FunctionValue for call captures',()=>{
  const ast=parse('g(x):=f(x)*2');
  const ir=compileSelectedFunctionDefinition(ast,{writerId:'g',taskScopeId:'task',specs,
    makeBinderId:({index})=>`g:${index}`,
    resolveCallable:()=>providerReference('f'),
  });
  const identity=freeSymbolIdentity('task','f');
  assert.throws(()=>materializeSelectedFunctionValue(ir),/attested FunctionValue capture required/);
  assert.throws(()=>materializeSelectedFunctionValue(ir,{captures:[
    {providerId:'f',identity,value:integer(42)},
  ]}),/attested FunctionValue capture required/);
});

test('S93d: inlined call normalizes to portable immutable FunctionValue, not a callable capture',()=>{
  const f=compileSelectedFunctionDefinition(parse('f(x):=x+1'),{
    writerId:'f',taskScopeId:'task',specs,makeBinderId:({index})=>`f:${index}`,
  });
  const fv=materializeSelectedFunctionValue(f);
  const g=compileSelectedFunctionDefinition(parse('g(x):=f(x)*2'),{
    writerId:'g',taskScopeId:'task',specs,makeBinderId:({index})=>`g:${index}`,
    resolveCallable:()=>providerReference('f'),
  });
  const gv=materializeSelectedFunctionValue(g,{captures:[
    {providerId:'f',identity:freeSymbolIdentity('task','f'),value:fv},
  ]});
  assert.equal(gv.kind,'function');
  assert.equal(gv.data.capturedValues.length,0);
  assert.equal(gv.data.body.data.expr.op,'mul');
  assert.deepEqual(decodeValue(encodeValue(gv)),gv);
});
