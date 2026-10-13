import test from 'node:test';
import assert from 'node:assert/strict';
import {expression} from '../../src/js/values/value.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
function documentFixture(){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
 for(const [taskId,x] of [['A',10],['B',100]]) for(const [suffix,source] of [['x',`x:=${x}`],['f','f(t):=t+x'],['call','f(3)']])
  rt.addBlock({id:`${taskId}-${suffix}`,type:'formula',source,taskId});
 return rt;
}
const val=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
const gate=()=>{let enter,release;return {entered:new Promise(r=>enter=r),pending:new Promise(r=>release=r),enter:()=>enter(),release:()=>release()};};
function run(rt,scope,revision,evaluate,{pause,visits=[]}={}){
 let once=false;
 return rt.evaluateAndCommitDirtySemanticTask(scope,{revision,getCurrentRevision:()=>revision,createEvaluate:({snapshot,cachedOutcomes})=>{
  const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate,revision,cachedOutcomes});
  return async task=>{visits.push(task.blockId);const out=await base(task);
   if(pause&&!once&&task.blockId===`${scope}-call`){once=true;pause.enter();await pause.pending;}
   return out;};
 }});
}
const integer=n=>expression({op:'integer',value:String(n)});
const arithmetic=async (_envelope,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const op=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
test('S59 concurrent task-local captures 13 and 103',async()=>{
 const rt=documentFixture();const [a,b]=await Promise.all([run(rt,'A','a1',arithmetic),run(rt,'B','b1',arithmetic)]);
 assert.equal(a.kind,'complete');assert.equal(b.kind,'complete');assert.equal(val(rt,'A-call'),'13');assert.equal(val(rt,'B-call'),'103');
 assert.equal(rt.getBlock('A-f').calculation.result.data.capturedValues[0].identity.taskScopeId,'A');
 assert.equal(rt.getBlock('B-f').calculation.result.data.capturedValues[0].identity.taskScopeId,'B');
});
test('S59 old captured outcome loses to newer completed task A; task B is intact',async()=>{
 const rt=documentFixture(),g=gate();
 const old=run(rt,'A','a-old',arithmetic,{pause:g});await g.entered;
 await run(rt,'B','b',arithmetic);assert.equal(val(rt,'B-call'),'103');
 rt.setBlockSource('A-x','x:=20');
 const latest=await run(rt,'A','a-new',arithmetic);assert.equal(latest.kind,'complete');assert.equal(val(rt,'A-call'),'23');
 g.release();assert.equal((await old).kind,'stale');assert.equal(val(rt,'A-call'),'23');assert.equal(val(rt,'B-call'),'103');
});
test('S59 same revision reused cannot resurrect an outdated captured FunctionValue',async()=>{
 const rt=documentFixture(),g=gate();const old=run(rt,'A','shared',arithmetic,{pause:g});await g.entered;
 rt.setBlockSource('A-x','x:=20');assert.equal((await run(rt,'A','shared',arithmetic)).kind,'complete');
 g.release();assert.equal((await old).kind,'stale');assert.equal(val(rt,'A-call'),'23');
});
test('S59 stale result never automatically schedules another computation',async()=>{
 const rt=documentFixture(),g=gate(),oldVisits=[],newVisits=[];
 const old=run(rt,'A','old',arithmetic,{pause:g,visits:oldVisits});await g.entered;
 rt.setBlockSource('A-x','x:=20');await run(rt,'A','new',arithmetic,{visits:newVisits});
 const count=oldVisits.length;g.release();assert.equal((await old).kind,'stale');
 assert.equal(oldVisits.length,count);assert.equal(val(rt,'A-call'),'23');
});
