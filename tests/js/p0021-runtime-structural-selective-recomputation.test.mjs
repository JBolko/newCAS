import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async (_env,selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const op=selected.evaluationRequest.evaluatorId;
  return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
const doc=()=>{
  const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
  for(const [id,source] of [['first','f(x):=x^2+3x'],['ten','f(10)'],['second','f(x):=2x+1'],['three','f(3)']]) rt.addBlock({id,type:'formula',source,taskId:'default'});
  return rt;
};
const run=async (rt,revision,visited=[])=>rt.evaluateAndCommitDirtySemanticTask('default',{
 revision,getCurrentRevision:()=>revision,
 createEvaluate:({snapshot,cachedOutcomes})=>{
   const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
   return async task=>{visited.push(task.blockId);return base(task);};
 },
});
const result=(rt,id)=>rt.getBlock(id)?.calculation?.result?.data?.expr?.value;

test('S54 initial four-block document computes 130 and 7',async()=>{
 const rt=doc(),vis=[];assert.equal((await run(rt,'r1',vis)).kind,'complete');
 assert.deepEqual(vis,['first','ten','second','three']);
 assert.equal(result(rt,'ten'),'130');assert.equal(result(rt,'three'),'7');
});
test('S54 removal of later function rebinds only f(3) to first function and recomputes 18',async()=>{
 const rt=doc();await run(rt,'r1');
 const ten=rt.getBlock('ten').calculation.result, first=rt.getBlock('first').calculation.result;
 rt.removeBlock('second');
 assert.equal(rt.getBlock('three').calculation.status,'dirty');
 assert.equal(rt.getBlock('three').calculation.result,null);
 assert.equal(rt.getBlock('ten').calculation.status,'success');
 const vis=[];assert.equal((await run(rt,'r2',vis)).kind,'complete');
 assert.deepEqual(vis,['three']);assert.equal(result(rt,'three'),'18');
 assert.equal(rt.getBlock('ten').calculation.result,ten);assert.equal(rt.getBlock('first').calculation.result,first);
});
test('S54 inserting later function rebinds only downstream call, keeps earlier cached Values',async()=>{
 const rt=doc();await run(rt,'r1');rt.removeBlock('second');await run(rt,'r2');
 const oldTen=rt.getBlock('ten').calculation.result,oldFirst=rt.getBlock('first').calculation.result;
 rt.insertBlock({id:'replacement',type:'formula',source:'f(x):=2x+1',taskId:'default'},2);
 assert.equal(rt.getBlock('three').calculation.result,null);
 const vis=[];assert.equal((await run(rt,'r3',vis)).kind,'complete');
 assert.deepEqual(vis,['replacement','three']);assert.equal(result(rt,'three'),'7');
 assert.equal(rt.getBlock('ten').calculation.result,oldTen);assert.equal(rt.getBlock('first').calculation.result,oldFirst);
});
test('S54 deleting first definition invalidates earlier call, never binds it forward',async()=>{
 const rt=doc();await run(rt,'r1');const second=rt.getBlock('second').calculation.result;
 rt.removeBlock('first');
 assert.equal(rt.getBlock('ten').calculation.result,null);
 const vis=[];const outcome=await run(rt,'r2',vis);
 assert.equal(outcome.kind,'complete');
 assert.equal(rt.getBlock('ten').calculation.status,'error');
 assert.equal(rt.getBlock('ten').calculation.result,null);
 assert.equal(result(rt,'three'),'7');
 assert.equal(rt.getBlock('second').calculation.result,second);
 assert.ok(!vis.includes('second'));
});
test('S54 editing later function invalidates only its downstream, not earlier call',async()=>{
 const rt=doc();await run(rt,'r1');const oldTen=rt.getBlock('ten').calculation.result;
 rt.setBlockSource('second','f(x):=3x+1');
 const vis=[];assert.equal((await run(rt,'r2',vis)).kind,'complete');
 assert.deepEqual(vis,['second','three']);assert.equal(result(rt,'three'),'10');
 assert.equal(rt.getBlock('ten').calculation.result,oldTen);
});
test('S54 moving later definition above f(10) changes first call provider, keeps f(3)',async()=>{
 const rt=doc();await run(rt,'r1');const oldThree=rt.getBlock('three').calculation.result;
 rt.moveBlock('second',1);
 assert.equal(rt.getBlock('ten').calculation.result,null);
 const vis=[];assert.equal((await run(rt,'r2',vis)).kind,'complete');
 assert.deepEqual(vis,['ten']);
 assert.equal(result(rt,'ten'),'21');assert.equal(rt.getBlock('three').calculation.result,oldThree);
});
test('S54 moving later definition past f(3) restores first function for f(3)',async()=>{
 const rt=doc();await run(rt,'r1');const oldTen=rt.getBlock('ten').calculation.result;
 rt.moveBlock('second',3);
 assert.equal(rt.getBlock('three').calculation.result,null);
 const vis=[];assert.equal((await run(rt,'r2',vis)).kind,'complete');
 assert.deepEqual(vis,['three']);assert.equal(result(rt,'three'),'18');
 assert.equal(rt.getBlock('ten').calculation.result,oldTen);
});
