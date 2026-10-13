import test from 'node:test';
import assert from 'node:assert/strict';
import {expression} from '../../src/js/values/value.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';

const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const integer=n=>expression({op:'integer',value:String(n)});
const arithmetic=async (_envelope,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const id=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
function fixture(){
 const runtime=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
 for (const [scope,x] of [['A',10],['B',100]]) for (const [name,source] of [['x',`x:=${x}`],['f','f(t):=t+x'],['call','f(3)']])
  runtime.addBlock({id:`${scope}-${name}`,type:'formula',source,taskId:scope});
 return runtime;
}
function gate(){let entered,release;return {entered:new Promise(r=>entered=r),waiting:new Promise(r=>release=r),enter:()=>entered(),release:()=>release()};}
function execute(runtime,scope,revision,{pause,visits=[],current=()=>revision}={}){
 let paused=false;
 return runtime.evaluateAndCommitDirtySemanticTask(scope,{revision,getCurrentRevision:current,createEvaluate:({snapshot,cachedOutcomes})=>{
  const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
  return async task=>{visits.push(task.blockId);const outcome=await evaluate(task);
   if(pause&&!paused&&task.blockId===`${scope}-call`){paused=true;pause.enter();await pause.waiting;}
   return outcome;};
 }});
}
const value=(runtime,id)=>runtime.getBlock(id).calculation.result?.data?.expr?.value;
const capture=(runtime,scope)=>runtime.getBlock(`${scope}-f`).calculation.result.data.capturedValues[0];

test('S60 three overlapping captured generations commit only newest despite inverse delivery order',async()=>{
 const rt=fixture(),g1=gate(),g2=gate(),oldVisits=[],middleVisits=[],lastVisits=[];
 const old=execute(rt,'A','r1',{pause:g1,visits:oldVisits});await g1.entered;
 rt.setBlockSource('A-x','x:=20');
 const middle=execute(rt,'A','r2',{pause:g2,visits:middleVisits});await g2.entered;
 rt.setBlockSource('A-x','x:=30');
 const newest=await execute(rt,'A','r3',{visits:lastVisits});
 assert.equal(newest.kind,'complete');assert.equal(value(rt,'A-call'),'33');
 g2.release();assert.equal((await middle).kind,'stale');
 g1.release();assert.equal((await old).kind,'stale');
 assert.equal(value(rt,'A-call'),'33');assert.equal(value(rt,'A-x'),'30');
 assert.deepEqual(lastVisits,['A-x','A-f','A-call']);
 assert.equal(oldVisits.filter(id=>id==='A-call').length,1);
 assert.equal(middleVisits.filter(id=>id==='A-call').length,1);
});

test('S60 delayed oldest capture does not change other task outcomes or identities',async()=>{
 const rt=fixture();await execute(rt,'B','b1');const original=capture(rt,'B');
 const g=gate(),old=execute(rt,'A','a1',{pause:g});await g.entered;
 rt.setBlockSource('A-x','x:=30');await execute(rt,'A','a2');
 g.release();assert.equal((await old).kind,'stale');
 assert.equal(value(rt,'B-call'),'103');assert.equal(value(rt,'A-call'),'33');
 assert.deepEqual(capture(rt,'B'),original);
 assert.equal(capture(rt,'A').identity.taskScopeId,'A');
 assert.equal(capture(rt,'B').identity.taskScopeId,'B');
});

test('S60 source and generation guard protect same-revision triple overlap',async()=>{
 const rt=fixture(),g1=gate(),g2=gate();
 const first=execute(rt,'A','shared',{pause:g1});await g1.entered;
 rt.setBlockSource('A-x','x:=20');const second=execute(rt,'A','shared',{pause:g2});await g2.entered;
 rt.setBlockSource('A-x','x:=30');assert.equal((await execute(rt,'A','shared')).kind,'complete');
 g1.release();g2.release();
 assert.equal((await first).kind,'stale');assert.equal((await second).kind,'stale');
 assert.equal(value(rt,'A-call'),'33');
});

test('S60 rejected stale results do not trigger another calculation',async()=>{
 const rt=fixture(),g=gate(),count=[];
 const old=execute(rt,'A','old',{pause:g,visits:count});await g.entered;
 rt.setBlockSource('A-x','x:=30');await execute(rt,'A','new');
 const before=count.length;g.release();assert.equal((await old).kind,'stale');
 assert.equal(count.length,before);assert.equal(value(rt,'A-call'),'33');
});

test('S60 changing one captured variable preserves independent task cache',async()=>{
 const rt=fixture(),visits=[];await execute(rt,'A','init');await execute(rt,'B','init');
 const before=capture(rt,'B');rt.setBlockSource('A-x','x:=20');
 await execute(rt,'A','updated',{visits});
 assert.deepEqual(visits,['A-x','A-f','A-call']);
 assert.equal(value(rt,'A-call'),'23');assert.equal(value(rt,'B-call'),'103');
 assert.deepEqual(capture(rt,'B'),before);
 assert.equal(rt.getBlock('B-call').calculation.status,'success');
});
