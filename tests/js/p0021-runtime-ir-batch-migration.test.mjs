import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async (_envelope,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const id=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
function runtime(rows,taskId='A'){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy engine invoked')}},'doc');
 for(const [id,source] of rows)rt.addBlock({id,source,type:'formula',taskId});
 return rt;
}
async function run(rt,taskId='A',revision='v1'){
 const {snapshot}=rt.deriveSemanticTask(taskId);
 const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision});
 return rt.evaluateAndCommitSemanticTask(taskId,{revision,getCurrentRevision:()=>revision,evaluate});
}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
test('Slice76: active DocumentRuntime batch executes nested calls and assignment through attested IR',async()=>{
 const rt=runtime([['a','a:=2'],['f','f(t):=t^2+a'],['g','g(t):=3t'],['c','c:=f(g(4))+1'],['read','c']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'c'),'147');assert.equal(value(rt,'read'),'147');
});
test('Slice76: revised capture changes downstream but independent function remains stable',async()=>{
 const rt=runtime([['a','a:=2'],['f','f(t):=t^2+a'],['g','g(t):=3t'],['out','f(g(4))']]);
 await run(rt);const before=rt.getBlock('g').calculation.result;
 rt.setBlockSource('a','a:=5');assert.equal((await run(rt,'A','v2')).kind,'complete');
 assert.equal(value(rt,'out'),'149');assert.deepEqual(rt.getBlock('g').calculation.result,before);
});
test('Slice76: long identifier is one provider, never split as implicit multiplication',async()=>{
 const rt=runtime([['a','a:=2'],['b','b:=3'],['ab','ab:=11'],['long','long:=ab+1'],['product','product:=a b+1']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'long'),'12');assert.equal(value(rt,'product'),'7');
});
test('Slice76: no fallback to a callable defined after the source block',async()=>{
 const rt=runtime([['f','f(t):=t+1'],['out','f(g(4))'],['g','g(t):=3t']]);
 await run(rt);assert.equal(rt.getBlock('out').calculation.result,null);
});
test('Slice76: repeated nested invocation reuses the attested callable identity',async()=>{
 const rt=runtime([['f','f(x):=x^2+1'],['out','f(f(2))']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'out'),'26');
});
