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
test('long name ab remains one identifier, not implicit a*b',()=>{
 assert.equal(parse('ab')[0].name,'ab');
 assert.equal(parse('a b')[0].op,'*');
 assert.equal(parse('a*b')[0].op,'*');
 assert.equal(parse('ab+1')[0].left.name,'ab');
});
test('general arithmetic assignment and variable read are evaluated through DocumentRuntime',async()=>{
 const rt=make([['a','a:=2'],['b','b:=3'],['c','c:=a*b+1'],['read','c']]);
 assert.equal((await run(rt)).kind,'complete');
 assert.equal(value(rt,'c'),'7');assert.equal(value(rt,'read'),'7');
});
test('whitespace multiplication and long-name variable produce distinct values',async()=>{
 const rt=make([['a','a:=2'],['b','b:=3'],['ab','ab:=11'],['product','product:=a b+1'],['named','named:=ab+1']]);
 assert.equal((await run(rt)).kind,'complete');
 assert.equal(value(rt,'product'),'7');assert.equal(value(rt,'named'),'12');
});
test('changing a recomputes c, preserving unrelated ab writer',async()=>{
 const rt=make([['a','a:=2'],['b','b:=3'],['ab','ab:=11'],['c','c:=a*b+1']]);
 await run(rt);const original=rt.getBlock('ab').calculation.result;
 rt.setBlockSource('a','a:=4');
 assert.equal((await run(rt,'r2')).kind,'complete');
 assert.equal(value(rt,'c'),'13');assert.deepEqual(rt.getBlock('ab').calculation.result,original);
});
test('missing provider fails closed instead of resolving long name by splitting',async()=>{
 const rt=make([['a','a:=2'],['b','b:=3'],['c','c:=ab+1']]);
 await run(rt);assert.equal(rt.getBlock('c').calculation.status,'error');assert.equal(rt.getBlock('c').calculation.result,null);
});
