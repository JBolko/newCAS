import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async(_envelope,selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const id=selected.evaluationRequest.evaluatorId;
  return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
function make(entries){const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy engine forbidden')}},'document');for(const [id,source] of entries)rt.addBlock({id,type:'formula',source,taskId:'default'});return rt;}
async function run(rt,revision='r1'){const {snapshot}=rt.deriveSemanticTask();const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision});return rt.evaluateAndCommitSemanticTask('default',{revision,getCurrentRevision:()=>revision,evaluate});}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;

test('one recursive expression route handles literal assignment, function call, arithmetic assignment and variable read',async()=>{
 const rt=make([['a','a:=2'],['f','f(t):=t^2+a'],['g','g(t):=3t'],['c','c:=f(g(4))+1'],['read','c']]);
 assert.equal((await run(rt)).kind,'complete');
 assert.equal(value(rt,'a'),'2');assert.equal(value(rt,'c'),'147');assert.equal(value(rt,'read'),'147');
});
test('updating a capture invalidates nested assignment and downstream read',async()=>{
 const rt=make([['a','a:=2'],['f','f(t):=t^2+a'],['g','g(t):=3t'],['c','c:=f(g(4))+1'],['read','c']]);
 await run(rt);rt.setBlockSource('a','a:=5');
 assert.equal((await run(rt,'r2')).kind,'complete');
 assert.equal(value(rt,'c'),'150');assert.equal(value(rt,'read'),'150');
});
test('long identifier survives unified assignment and read path',async()=>{
 const rt=make([['ab','ab:=11'],['result','result:=ab+1'],['read','result']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'read'),'12');
});
test('unresolved nested callable cannot read a later writer or retain a stale value',async()=>{
 const rt=make([['f','f(t):=t+1'],['out','out:=f(g(2))'],['g','g(t):=t+2']]);
 await run(rt);assert.equal(rt.getBlock('out').calculation.result,null);
 assert.notEqual(rt.getBlock('out').calculation.status,'success');
});
