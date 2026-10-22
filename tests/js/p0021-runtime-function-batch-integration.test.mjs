import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression,isValue} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async (_envelope,selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const op=selected.evaluationRequest.evaluatorId;
  return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
const make=items=>{
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine must not run')}},'document');
 for(const [id,source] of items) rt.addBlock({id,type:'formula',source,taskId:'default'});
 return rt;
};
const run=async(rt,revision='r1')=>{
 const {snapshot}=rt.deriveSemanticTask();
 const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision});
 return rt.evaluateAndCommitSemanticTask('default',{revision,getCurrentRevision:()=>revision,evaluate});
};
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
const initial=[['f1','f(x):=x^2+3x'],['ten','f(10)']];
test('S51 existing DocumentRuntime computes own definition then f(10)=130 in one batch',async()=>{
 const rt=make(initial);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.deepEqual(result.state.outcomes.map(o=>o.blockId),['f1','ten']);
 assert.equal(rt.getBlock('f1').calculation.status,'success');
 assert.ok(isValue(rt.getBlock('f1').calculation.result));
 assert.equal(rt.getBlock('f1').calculation.result.kind,'function');
 assert.equal(value(rt,'ten'),'130');
});
test('S51 positional redefinition computes both independently: 130 and 7',async()=>{
 const rt=make([...initial,['f2','f(x):=2x+1'],['three','f(3)']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.deepEqual(result.state.outcomes.map(o=>o.blockId),['f1','ten','f2','three']);
 assert.equal(value(rt,'ten'),'130');assert.equal(value(rt,'three'),'7');
});
test('S51 removing later definition rebinds f(3) to first writer and produces 18',async()=>{
 const rt=make([...initial,['f2','f(x):=2x+1'],['three','f(3)']]);
 await run(rt);rt.removeBlock('f2');
 const result=await run(rt,'r2');
 assert.equal(result.kind,'complete'); assert.equal(value(rt,'ten'),'130');assert.equal(value(rt,'three'),'18');
});
test('S51 no cross-batch provider reuse or global name fallback',async()=>{
 const rt=make([['ten','f(10)'],['f2','f(x):=2x+1'],['three','f(3)']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.equal(rt.getBlock('ten').calculation.status,'error');
 assert.equal(rt.getBlock('ten').calculation.result,null);
 assert.equal(value(rt,'three'),'7');
});
test('S51 unsupported source fails closed; no old engine call',async()=>{
 const rt=make([['f','f(x):=x^2+3x'],['bad','f(1[m])']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.equal(rt.getBlock('bad').calculation.status,'error');
 assert.equal(rt.getBlock('bad').calculation.result,null);
});
