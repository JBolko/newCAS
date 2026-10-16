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
const arithmetic=async (_env,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const op=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(...a)=>resolve(...a)};};
const tick=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
function clock(){let now=0,id=0;const timers=new Map();return {
 scheduleDelay(fn,ms){const n=++id;timers.set(n,{at:now+ms,fn});return n;},
 cancelDelay(id){timers.delete(id);},
 advance(ms){now+=ms;while(true){const ready=[...timers].filter(([,v])=>v.at<=now).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);if(!ready.length)break;const [id,t]=ready[0];timers.delete(id);t.fn();}},
 get size(){return timers.size;}
};}
function setup(rt,scope='A',x=10){for(const [id,source] of [['x',`x:=${x}`],['f','f(t):=t^2+3t'],['call','f(x)']])rt.addBlock({id:`${scope}-${id}`,type:'formula',taskId:scope,source});}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
function harness({withB=false}={}){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy engine called');}},'doc');setup(rt);if(withB)setup(rt,'B',100);
 const c=clock(),entered=deferred(),release=deferred(),visits=[],outcomes=[],errors=[];let first=true;
 const scheduler=createSemanticAutoScheduler({runtime:rt,delayMs:40,scheduleDelay:c.scheduleDelay,cancelDelay:c.cancelDelay,
  createEvaluate:({snapshot,cachedOutcomes,revision,taskId})=>{
   const run=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
   return async task=>{visits.push([taskId,task.blockId]);const result=await run(task);
    if(first&&taskId==='A'&&task.blockId==='A-call'){first=false;entered.resolve();await release.promise;}
    return result;};
  },onOutcome:(task,result)=>outcomes.push([task,result]),onError:(...a)=>errors.push(a)});
 return {rt,c,entered,release,visits,outcomes,errors,scheduler};
}

test('S64 delayed edits coalesce while old run waits; newest commits, old is stale',async()=>{
 const h=harness();const {rt,c,entered,release,visits,outcomes,scheduler}=h;
 scheduler.request('A');c.advance(40);await entered.promise;
 rt.setBlockSource('A-x','x:=20');c.advance(20);await tick();
 rt.setBlockSource('A-x','x:=30');c.advance(20);await tick();
 rt.setBlockSource('A-x','x:=3');c.advance(39);await tick();
 assert.equal(value(rt,'A-call'),undefined);assert.equal(outcomes.length,0);
 c.advance(1);await tick();assert.equal(value(rt,'A-call'),'18');assert.equal(outcomes.length,1);
 const visitsBefore=visits.length;release.resolve();await tick();await tick();
 assert.deepEqual(outcomes.map(([,o])=>o.kind).sort(),['complete','stale']);
 assert.equal(value(rt,'A-call'),'18');assert.equal(visits.length,visitsBefore);assert.equal(c.size,0);
 scheduler.dispose();
});

test('S64 independent task B commits while A is blocked and debounce is pending',async()=>{
 const h=harness({withB:true});const {rt,c,entered,release,visits,outcomes,scheduler}=h;
 scheduler.request('A');scheduler.request('B');c.advance(40);await entered.promise;await tick();
 assert.equal(value(rt,'B-call'),'10300');const bResult=rt.getBlock('B-call').calculation.result;
 rt.setBlockSource('A-x','x:=3');c.advance(40);await tick();
 assert.equal(value(rt,'A-call'),'18');assert.strictEqual(rt.getBlock('B-call').calculation.result,bResult);
 assert.equal(visits.filter(([task])=>task==='B').length,3);
 release.resolve();await tick();assert.deepEqual(outcomes.filter(([t])=>t==='A').map(([,r])=>r.kind).sort(),['complete','stale']);
 assert.strictEqual(rt.getBlock('B-call').calculation.result,bResult);scheduler.dispose();
});

test('S64 stale completion causes neither a timer nor a subsequent dispatch',async()=>{
 const h=harness();const {rt,c,entered,release,visits,outcomes,scheduler}=h;
 scheduler.request('A');c.advance(40);await entered.promise;
 rt.setBlockSource('A-x','x:=3');c.advance(40);await tick();
 const count=visits.length;release.resolve();await tick();
 c.advance(400);await tick();assert.equal(visits.length,count);assert.equal(outcomes.length,2);assert.equal(c.size,0);
 scheduler.dispose();
});

test('S64 dispose during old pending run cancels debounce and forbids further scheduling',async()=>{
 const h=harness();const {rt,c,entered,release,visits,scheduler}=h;
 scheduler.request('A');c.advance(40);await entered.promise;
 rt.setBlockSource('A-x','x:=3');assert.equal(c.size,1);
 scheduler.dispose();assert.equal(c.size,0);c.advance(500);await tick();
 const before=visits.length;release.resolve();await tick();
 assert.equal(visits.length,before);assert.equal(value(rt,'A-call'),undefined);
});
