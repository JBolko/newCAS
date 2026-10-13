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
const gate=()=>{let release,entered;return {entered:new Promise(r=>entered=r),pending:new Promise(r=>release=r),enter:()=>entered(),release:()=>release()};};
function document(){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
 for(const [taskId,initial] of [['A',10],['B',100]]){
  for(const [suffix,source] of [['x',`x:=${initial}`],['f','f(t):=t^2+3t'],['call','f(x)']])
   rt.addBlock({id:`${taskId}-${suffix}`,type:'formula',source,taskId});
 }
 return rt;
}
function run(rt,scope,revision,{pause,visits=[]}={}){
 let once=false;
 return rt.evaluateAndCommitDirtySemanticTask(scope,{revision,getCurrentRevision:()=>revision,
  createEvaluate:({snapshot,cachedOutcomes})=>{
   const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
   return async task=>{visits.push(task.blockId);if(pause&&!once&&task.blockId===`${scope}-call`){once=true;pause.enter();await pause.pending;}return base(task);};
  }});
}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;

test('S57 identical local names in two task scopes yield distinct provider bindings',()=>{
 const rt=document();
 const a=rt.deriveSemanticTask('A').snapshot,b=rt.deriveSemanticTask('B').snapshot;
 assert.equal(a.taskScopeId,'A');assert.equal(b.taskScopeId,'B');
 assert.deepEqual(a.blocks.find(x=>x.blockId==='A-call').calls.map(c=>c.providerId),['A-f']);
 assert.deepEqual(b.blocks.find(x=>x.blockId==='B-call').calls.map(c=>c.providerId),['B-f']);
});
test('S57 concurrent scopes produce their own values and do not call legacy CASEngine',async()=>{
 const rt=document();const [a,b]=await Promise.all([run(rt,'A','ra'),run(rt,'B','rb')]);
 assert.equal(a.kind,'complete');assert.equal(b.kind,'complete');
 assert.equal(value(rt,'A-call'),'130');assert.equal(value(rt,'B-call'),'10300');
});
test('S57 A edit during overlapping rounds rejects A old response but preserves B',async()=>{
 const rt=document(),g=gate();const old=run(rt,'A','ra1',{pause:g});await g.entered;
 const b=await run(rt,'B','rb1');assert.equal(b.kind,'complete');assert.equal(value(rt,'B-call'),'10300');
 rt.setBlockSource('A-x','x:=3');
 const newer=await run(rt,'A','ra2');assert.equal(newer.kind,'complete');assert.equal(value(rt,'A-call'),'18');
 g.release();assert.equal((await old).kind,'stale');
 assert.equal(value(rt,'A-call'),'18');assert.equal(value(rt,'B-call'),'10300');
});
test('S57 editing task A does not invalidate task B or re-evaluate B providers',async()=>{
 const rt=document();await run(rt,'A','r1');await run(rt,'B','r1');
 const originalB=rt.getBlock('B-f').calculation.result;
 rt.setBlockSource('A-x','x:=3');
 assert.equal(rt.getBlock('B-call').calculation.status,'success');
 const visits=[];await run(rt,'B','r2',{visits});
 assert.deepEqual(visits,[]);assert.equal(rt.getBlock('B-f').calculation.result,originalB);
 assert.equal(value(rt,'B-call'),'10300');
});
test('S57 captured document variables are scoped, never imported from another task',async()=>{
 const rt=document();rt.setBlockSource('A-f','f(t):=t+x');
 const result=await run(rt,'A','ra');assert.equal(result.kind,'complete');
 assert.equal(rt.getBlock('A-f').calculation.status,'success');
 assert.equal(value(rt,'A-call'),'20');
 const b=await run(rt,'B','rb');assert.equal(b.kind,'complete');assert.equal(value(rt,'B-call'),'10300');
});
