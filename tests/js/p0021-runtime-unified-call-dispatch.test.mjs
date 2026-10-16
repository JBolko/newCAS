import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const evaluated=[];
const arithmetic=async (_envelope,selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const id=selected.evaluationRequest.evaluatorId;
  evaluated.push(id);
  return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
function make(entries) {const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy engine forbidden')}},'document');for(const [id,source] of entries)rt.addBlock({id,type:'formula',source,taskId:'default'});return rt;}
async function run(rt,revision='r1'){const {snapshot}=rt.deriveSemanticTask();const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision});return rt.evaluateAndCommitSemanticTask('default',{revision,getCurrentRevision:()=>revision,evaluate});}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;

test('unified callable path evaluates literal, variable, nested, and arithmetic arguments in one runtime batch',async()=>{
 const rt=make([['x','x:=3'],['f','f(t):=t^2+1'],['literal','f(2)'],['variable','f(x)'],['arithmetic','f(1+2)'],['nested','f(f(2))']]);
 assert.equal((await run(rt)).kind,'complete');
 assert.deepEqual(['literal','variable','arithmetic','nested'].map(id=>value(rt,id)),['5','10','10','26']);
});
test('unified callable path reuses source attestations for nested repeated names',async()=>{
 const rt=make([['f','f(t):=t+1'],['out','f(f(f(2)))']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'out'),'5');
});
test('unified callable path respects both different providers and captured values',async()=>{
 const rt=make([['a','a:=2'],['f','f(t):=t^2+a'],['g','g(t):=3t'],['out','f(g(4))']]);
 assert.equal((await run(rt)).kind,'complete');assert.equal(value(rt,'out'),'146');
 rt.setBlockSource('a','a:=5');assert.equal((await run(rt,'r2')).kind,'complete');assert.equal(value(rt,'out'),'149');
});
test('unified callable path never resolves a callable from a later writer',async()=>{
 const rt=make([['f','f(t):=t+1'],['out','f(g(2))'],['g','g(t):=t+2']]);
 await run(rt);assert.equal(rt.getBlock('out').calculation.result,null);
});
