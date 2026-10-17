/** S93c GREEN controls: do not regress already supported callable application. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
const integer = n => expression({op:'integer',value:String(n)});
const specs = new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,
  evaluatorId:`s93c.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const evalLeaf = async(_request, selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const id=selected.evaluationRequest.evaluatorId;
  return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
const make = rows=>{
  const r=new DocumentRuntime({calculate:async()=>{throw Error('LEGACY_ENGINE_FORBIDDEN');}},'s93c');
  for(const [id,source] of rows) r.addBlock({id,type:'formula',source,taskId:'default'});
  return r;
};
const run = (rt,revision='r1') => {
  const {snapshot}=rt.deriveSemanticTask();
  return rt.evaluateAndCommitSemanticTask('default',{revision,getCurrentRevision:()=>revision,
    evaluate:createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:evalLeaf,revision})});
};
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;

test('S93c GREEN: ordinary nesting f(f(2)) already evaluates through attested IR',async()=>{
  const r=make([['f','f(x):=x^2+1'],['out','f(f(2))']]);
  assert.equal((await run(r)).kind,'complete');
  assert.equal(value(r,'out'),'26');
});
test('S93c GREEN: positional capture of earlier scalar a survives a later redefinition',async()=>{
  const r=make([['a1','a:=2'],['f','f(x):=a*x'],['a2','a:=10'],['out','f(3)']]);
  assert.equal((await run(r)).kind,'complete');
  assert.equal(value(r,'out'),'6');
});
test('S93c GREEN: unresolved forward function call never falls back to a later writer',async()=>{
  const r=make([['out','f(3)'],['f','f(x):=x+1']]);
  await run(r);
  assert.notEqual(r.getBlock('out').calculation.status,'success');
});
