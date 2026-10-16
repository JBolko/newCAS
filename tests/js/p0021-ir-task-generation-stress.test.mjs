import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSemanticAutoScheduler} from '../../src/js/semantics/create-semantic-auto-scheduler.js';

const integer = n => expression({op:'integer',value:String(n)});
const specs = new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic = async (_env,selected) => {
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const id=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
const deferred = () => {let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick = async () => {await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
function clock(){let now=0,id=0;const timers=new Map();return {
 scheduleDelay(fn,ms){const key=++id;timers.set(key,{at:now+ms,fn});return key;},
 cancelDelay(key){timers.delete(key);},
 advance(ms){now+=ms;while(true){const ready=[...timers].filter(([,v])=>v.at<=now).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);if(!ready.length)break;const [key,entry]=ready[0];timers.delete(key);entry.fn();}},
 get size(){return timers.size;}
};}
const result=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
function setup(rt,task,a){
 for(const [id,source] of [['a',`a:=${a}`],['f','f(t):=t^2+a'],['g','g(t):=3t'],['call','f(g(4))'],['assigned','answer:=f(g(4))+1'],['read','answer']])
  rt.addBlock({id:`${task}-${id}`,type:'formula',taskId:task,source});
}
function harness(){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy engine invoked')}},'doc');
 setup(rt,'A',2);setup(rt,'B',10);
 const c=clock(),entered=deferred(),release=deferred(),visits=[],outcomes=[],errors=[];let pause=true;
 const scheduler=createSemanticAutoScheduler({runtime:rt,delayMs:40,scheduleDelay:c.scheduleDelay,cancelDelay:c.cancelDelay,
  createEvaluate:({snapshot,cachedOutcomes,revision,taskId})=>{
   const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
   return async task=>{
    visits.push([taskId,task.blockId]);const outcome=await evaluate(task);
    if(pause && taskId==='A' && task.blockId==='A-call'){pause=false;entered.resolve();await release.promise;}
    return outcome;
   };
  },onOutcome:(task,outcome)=>outcomes.push([task,outcome]),onError:(...args)=>errors.push(args)});
 return {rt,c,entered,release,visits,outcomes,errors,scheduler};
}

test('S77: IR composed functions are isolated between tasks with identical variable/function names',async()=>{
 const h=harness();h.scheduler.request('B');h.c.advance(40);await tick();
 assert.equal(result(h.rt,'B-call'),'154');assert.equal(result(h.rt,'B-assigned'),'155');assert.equal(result(h.rt,'B-read'),'155');
 assert.equal(result(h.rt,'A-call'),undefined);assert.deepEqual(h.errors,[]);h.scheduler.dispose();
});

test('S77: delayed old IR generation cannot overwrite new composed result, while B remains unchanged',async()=>{
 const h=harness();h.scheduler.request('A');h.scheduler.request('B');h.c.advance(40);await h.entered.promise;await tick();
 const b=h.rt.getBlock('B-read').calculation.result;
 assert.equal(result(h.rt,'B-read'),'155');
 h.rt.setBlockSource('A-a','a:=20');h.c.advance(20);await tick();
 h.rt.setBlockSource('A-a','a:=30');h.c.advance(20);await tick();
 h.rt.setBlockSource('A-a','a:=5');h.c.advance(39);await tick();
 assert.equal(h.outcomes.filter(([task])=>task==='A').length,0);
 h.c.advance(1);await tick();
 assert.equal(result(h.rt,'A-call'),'149');assert.equal(result(h.rt,'A-assigned'),'150');assert.equal(result(h.rt,'A-read'),'150');
 assert.strictEqual(h.rt.getBlock('B-read').calculation.result,b);
 h.release.resolve();await tick();await tick();
 assert.deepEqual(h.outcomes.filter(([task])=>task==='A').map(([,outcome])=>outcome.kind).sort(),['complete','stale']);
 assert.equal(result(h.rt,'A-read'),'150');assert.strictEqual(h.rt.getBlock('B-read').calculation.result,b);
 assert.deepEqual(h.errors,[]);h.scheduler.dispose();
});

test('S77: old IR completion cannot schedule another round and untouched task B is never reevaluated',async()=>{
 const h=harness();h.scheduler.request('A');h.scheduler.request('B');h.c.advance(40);await h.entered.promise;await tick();
 const bVisits=h.visits.filter(([task])=>task==='B').length;
 h.rt.setBlockSource('A-a','a:=5');h.c.advance(40);await tick();
 const before=h.visits.length;h.release.resolve();await tick();h.c.advance(500);await tick();
 assert.equal(h.visits.length,before);assert.equal(h.visits.filter(([task])=>task==='B').length,bVisits);
 assert.equal(h.c.size,0);assert.equal(result(h.rt,'A-read'),'150');assert.equal(result(h.rt,'B-read'),'155');
 h.scheduler.dispose();
});

test('S77: disposing scheduler cancels pending IR retry without altering an independently completed task',async()=>{
 const h=harness();h.scheduler.request('A');h.scheduler.request('B');h.c.advance(40);await h.entered.promise;await tick();
 const b=h.rt.getBlock('B-read').calculation.result;
 h.rt.setBlockSource('A-a','a:=5');assert.equal(h.c.size,1);
 h.scheduler.dispose();assert.equal(h.c.size,0);h.c.advance(500);await tick();
 h.release.resolve();await tick();
 assert.strictEqual(h.rt.getBlock('B-read').calculation.result,b);
 assert.equal(result(h.rt,'A-call'),undefined);assert.equal(h.outcomes.filter(([task])=>task==='A').length,1);
 assert.equal(h.outcomes.find(([task])=>task==='A')[1].kind,'stale');
});
