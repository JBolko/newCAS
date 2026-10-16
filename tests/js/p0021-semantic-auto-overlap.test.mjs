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


test('S62 three edits while first run awaits coalesce into one latest round',async()=>{
 const rt=make();setup(rt);const started=deferred(), release=deferred(),visits=[],outcomes=[];
 let first=true;
 const pause={shouldPause:(_,id)=>id==='default-call'&&first,
  reached:()=>{first=false;started.resolve();},wait:release.promise};
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits,pause),onOutcome:(...v)=>outcomes.push(v)});
 s.request('default');await started.promise;
 rt.setBlockSource('default-x','x:=20');rt.setBlockSource('default-x','x:=30');rt.setBlockSource('default-x','x:=3');
 await tick();assert.equal(value(rt,'default-call'),'18');assert.equal(outcomes.length,1);
 const before=visits.length;release.resolve();await tick();
 assert.deepEqual(outcomes.map(o=>o[1].kind).sort(),['complete','stale']);
 assert.equal(visits.length,before);assert.equal(value(rt,'default-call'),'18');s.dispose();
});
test('S62 latest complete precedes older stale without rollback or retry',async()=>{
 const rt=make();setup(rt);const hit=deferred(),release=deferred(),visits=[],outcomes=[];
 let first=true;
 const pause={shouldPause:(_,id)=>id==='default-call'&&first,
  reached:()=>{first=false;hit.resolve();},wait:release.promise};
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits,pause),onOutcome:(...v)=>outcomes.push(v)});
 s.request('default');await hit.promise;
 rt.setBlockSource('default-x','x:=3');await tick();
 const generation=rt.getBlock('default-call').calculation.generation;
 assert.equal(value(rt,'default-call'),'18');const count=visits.length;
 release.resolve();await tick();await tick();
 assert.equal(rt.getBlock('default-call').calculation.generation,generation);
 assert.equal(value(rt,'default-call'),'18');assert.equal(visits.length,count);
 assert.deepEqual(outcomes.map(o=>o[1].kind).sort(),['complete','stale']);s.dispose();
});
test('S62 pending task A does not invalidate completed task B',async()=>{
 const rt=make();setup(rt,'A',10);setup(rt,'B',100);
 const hit=deferred(),release=deferred(),visits=[],outcomes=[];let first=true;
 const pause={shouldPause:(task,id)=>task==='A'&&id==='A-call'&&first,
  reached:()=>{first=false;hit.resolve();},wait:release.promise};
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:instrument(visits,pause),onOutcome:(...v)=>outcomes.push(v)});
 s.request('A');s.request('B');await hit.promise;await tick();
 assert.equal(value(rt,'B-call'),'10300');const b=rt.getBlock('B-call').calculation.result;
 rt.setBlockSource('A-x','x:=3');await tick();
 assert.equal(value(rt,'A-call'),'18');assert.strictEqual(rt.getBlock('B-call').calculation.result,b);
 const count=visits.length;release.resolve();await tick();
 assert.equal(visits.length,count);assert.equal(value(rt,'B-call'),'10300');
 assert.deepEqual(outcomes.filter(x=>x[0]==='A').map(x=>x[1].kind).sort(),['complete','stale']);s.dispose();
});
test('S62 evaluator failure reports error and does not self-retry',async()=>{
 const rt=make();setup(rt);let runs=0;const errors=[];
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:()=>async()=>{runs++;throw Error('probe failure');},onError:(...v)=>errors.push(v)});
 s.request('default');await tick();await tick();
 assert(runs>=1);const count=runs;await tick();assert.equal(runs,count);assert.equal(errors.length,0);s.dispose();
});
test('S62 edits after a failed run request exactly one subsequent round',async()=>{
 const rt=make();setup(rt);const visits=[],errors=[],outcomes=[];let fail=true;
 const normal=instrument(visits);
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:args=>{
  if(fail){fail=false;return async()=>{throw Error('transient');};}
  return normal(args);
 },onError:(...v)=>errors.push(v),onOutcome:(...v)=>outcomes.push(v)});
 s.request('default');await tick();assert.equal(errors.length,0);assert.equal(outcomes.length,1);
 rt.setBlockSource('default-x','x:=3');await tick();
 assert.equal(value(rt,'default-call'),'18');assert.equal(outcomes.length,2);
 const count=visits.length;await tick();assert.equal(visits.length,count);s.dispose();
});
