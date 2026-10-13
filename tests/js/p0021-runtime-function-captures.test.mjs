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
function fixture(a=10,b=100){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
 for(const [scope,x] of [['A',a],['B',b]]) for(const [suffix,source] of [['x',`x:=${x}`],['f','f(t):=t+x'],['call','f(3)']])
  rt.addBlock({id:`${scope}-${suffix}`,type:'formula',source,taskId:scope});
 return rt;
}
const run=(rt,scope,rev='r')=>rt.evaluateAndCommitDirtySemanticTask(scope,{revision:rev,getCurrentRevision:()=>rev,createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision:rev,cachedOutcomes})});
const val=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
test('S58 two task-local captures evaluate to 13 and 103',async()=>{
 const rt=fixture(); const [a,b]=await Promise.all([run(rt,'A'),run(rt,'B')]);
 assert.equal(a.kind,'complete');assert.equal(b.kind,'complete');
 assert.equal(val(rt,'A-call'),'13');assert.equal(val(rt,'B-call'),'103');
 assert.equal(rt.getBlock('A-f').calculation.result.data.capturedValues.length,1);
 assert.equal(rt.getBlock('A-f').calculation.result.data.capturedValues[0].identity.taskScopeId,'A');
});
test('S58 edited source invalidates captured function and call only in its task',async()=>{
 const rt=fixture();await run(rt,'A');await run(rt,'B');
 const untouched=rt.getBlock('B-f').calculation.result;
 rt.setBlockSource('A-x','x:=20');
 assert.equal(rt.getBlock('A-f').calculation.status,'dirty');
 await run(rt,'A','r2');
 assert.equal(val(rt,'A-call'),'23');assert.equal(val(rt,'B-call'),'103');
 assert.equal(rt.getBlock('B-f').calculation.result,untouched);
});
test('S58 missing captured definition fails closed instead of importing other task value',async()=>{
 const rt=fixture();rt.removeBlock('A-x');await run(rt,'A');await run(rt,'B');
 assert.notEqual(rt.getBlock('A-f').calculation.status,'success');
 assert.notEqual(rt.getBlock('A-call').calculation.status,'success');
 assert.equal(val(rt,'B-call'),'103');
});
test('S58 function argument shadows same-name document writer rather than capturing it',async()=>{
 const rt=fixture();rt.setBlockSource('A-f','f(x):=x+1');
 await run(rt,'A');assert.equal(val(rt,'A-call'),'4');
 assert.equal(rt.getBlock('A-f').calculation.result.data.capturedValues.length,0);
});
