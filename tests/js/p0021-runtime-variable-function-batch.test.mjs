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
test('S52 document owns both assignment and function: f(x)=130',async()=>{
 const rt=make([['x','x:=10'],['f','f(t):=t^2+3t'],['call','f(x)']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.deepEqual(result.state.outcomes.map(o=>o.blockId),['x','f','call']);
 assert.equal(value(rt,'x'),'10');
 assert.equal(rt.getBlock('f').calculation.result.kind,'function');
 assert.equal(value(rt,'call'),'130');
});
test('S52 changing x to 3 re-evaluates result 18 with same immutable f',async()=>{
 const rt=make([['x','x:=10'],['f','f(t):=t^2+3t'],['call','f(x)']]);
 await run(rt);
 const original=rt.getBlock('f').calculation.result;
 rt.setBlockSource('x','x:=3');
 const updated=await run(rt,'r2');
 assert.equal(updated.kind,'complete');
 assert.equal(value(rt,'x'),'3');assert.equal(value(rt,'call'),'18');
 assert.deepEqual(rt.getBlock('f').calculation.result,original);
});
test('S52 missing argument writer fails closed, not from stale cache',async()=>{
 const rt=make([['f','f(t):=t^2+3t'],['call','f(x)']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.equal(rt.getBlock('call').calculation.status,'error');
 assert.equal(rt.getBlock('call').calculation.result,null);
});
test('S52 later x writer must not resolve earlier f(x)',async()=>{
 const rt=make([['f','f(t):=t^2+3t'],['call','f(x)'],['x','x:=10']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.equal(rt.getBlock('call').calculation.status,'error');
 assert.equal(value(rt,'x'),'10');
});
test('S52 unsupported source assignment does not become a writer Value',async()=>{
 const rt=make([['x','x:=1[m]'],['f','f(t):=t^2+3t'],['call','f(x)']]);
 const result=await run(rt);
 assert.equal(result.kind,'complete');
 assert.equal(rt.getBlock('x').calculation.status,'error');
 assert.equal(rt.getBlock('call').calculation.status,'error');
});
