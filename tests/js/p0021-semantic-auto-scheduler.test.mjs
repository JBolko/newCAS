import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSemanticAutoScheduler} from '../../src/js/semantics/create-semantic-auto-scheduler.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async (_envelope,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const op=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
const make=()=>new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'doc');
function setup(rt,scope='default',x=10){
 for(const [id,source] of [['x',`x:=${x}`],['f','f(t):=t^2+3t'],['call','f(x)']])
  rt.addBlock({id:`${scope}-${id}`,type:'formula',taskId:scope,source});
}
function instrument(visits, pause){
 return ({snapshot,cachedOutcomes,revision,taskId})=>{
  const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
  return async task=>{visits.push([taskId,task.blockId]); const result=await evaluate(task);
   if(pause?.shouldPause(taskId,task.blockId)){pause.reached();await pause.wait;} return result;};
 };
}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};

test('S61 multiple edits in same turn collapse to one selective run',async()=>{
 const rt=make();setup(rt);const visits=[],outcomes=[];
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits),onOutcome:(...v)=>outcomes.push(v)});
 rt.setBlockSource('default-x','x:=20');rt.setBlockSource('default-x','x:=3');
 await tick();assert.equal(outcomes.length,1);assert.equal(outcomes[0][1].kind,'complete');
 assert.equal(value(rt,'default-call'),'18');assert.deepEqual(visits.map(v=>v[1]),['default-x','default-f','default-call']);s.dispose();
});
test('S61 subsequent edit executes dirty subset, preserves function cache',async()=>{
 const rt=make();setup(rt);const visits=[],outcomes=[];
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits),onOutcome:(...v)=>outcomes.push(v)});
 s.request('default');await tick();const fn=rt.getBlock('default-f').calculation.result;
 visits.length=0;rt.setBlockSource('default-x','x:=3');await tick();
 assert.deepEqual(visits.map(v=>v[1]),['default-x','default-call']);assert.equal(value(rt,'default-call'),'18');
 assert.equal(rt.getBlock('default-f').calculation.result,fn);assert.equal(outcomes.length,2);s.dispose();
});
test('S61 stale completion never enqueues retry; newer edit wins',async()=>{
 const rt=make();setup(rt);const reached=deferred(),release=deferred(),visits=[],outcomes=[];
 let once=true;
 const pause={shouldPause:(_,id)=>id==='default-call'&&once,
  reached:()=>{once=false;reached.resolve();},wait:release.promise};
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits,pause),onOutcome:(...v)=>outcomes.push(v)});
 s.request('default');await reached.promise;
 rt.setBlockSource('default-x','x:=3');await tick();
 assert.equal(value(rt,'default-call'),'18');const before=visits.length;
 release.resolve();await tick();assert.equal(value(rt,'default-call'),'18');
 assert.equal(visits.length,before);assert.equal(outcomes.length,2);
 assert.deepEqual(outcomes.map(o=>o[1].kind).sort(),['complete','stale']);s.dispose();
});
test('S61 separate task edit cannot contaminate other task',async()=>{
 const rt=make();setup(rt,'A',10);setup(rt,'B',100);const visits=[],outcomes=[];
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits),onOutcome:(...v)=>outcomes.push(v)});
 s.request('A');s.request('B');await tick();assert.equal(value(rt,'B-call'),'10300');
 visits.length=0;rt.setBlockSource('A-x','x:=3');await tick();
 assert.equal(value(rt,'A-call'),'18');assert.equal(value(rt,'B-call'),'10300');
 assert(visits.every(v=>v[0]==='A'));s.dispose();
});
test('S61 unsuccessful edit and disposal do not trigger evaluation',async()=>{
 const rt=make();setup(rt);const visits=[],errors=[];
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits),onError:(...e)=>errors.push(e)});
 assert.throws(()=>rt.setBlockSource('default-x','('));await tick();assert.equal(visits.length,0);
 s.dispose();rt.setBlockSource('default-x','x:=3');await tick();assert.equal(visits.length,0);assert.equal(errors.length,0);
});
