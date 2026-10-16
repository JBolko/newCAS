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
async function run(rt,revision='r1') {const {snapshot}=rt.deriveSemanticTask();const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision});return rt.evaluateAndCommitSemanticTask('default',{revision,getCurrentRevision:()=>revision,evaluate});}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
test('f(g(4)) composes two source-attested FunctionValues with a capture',async()=>{
 const rt=make([['a','a:=2'],['f','f(x):=x^2+a'],['g','g(x):=3x'],['out','f(g(4))']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'out'),'146');
});
test('f(f(2)) selects two occurrences of the same callable provider',async()=>{
 const rt=make([['f','f(x):=x^2+1'],['out','f(f(2))']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'out'),'26');
});
test('changed capture recomputes composed result without invalidating independent g',async()=>{
 const rt=make([['a','a:=2'],['f','f(x):=x^2+a'],['g','g(x):=3x'],['out','f(g(4))']]);
 await run(rt);const before=rt.getBlock('g').calculation.result;
 rt.setBlockSource('a','a:=5');assert.equal((await run(rt,'r2')).kind,'complete');
 assert.equal(value(rt,'out'),'149');assert.deepEqual(rt.getBlock('g').calculation.result,before);
});
test('unresolved inner function does not fall back to a later definition',async()=>{
 const rt=make([['f','f(x):=x+1'],['out','f(g(4))'],['g','g(x):=3x']]);
 await run(rt);assert.equal(rt.getBlock('out').calculation.result,null);
});
