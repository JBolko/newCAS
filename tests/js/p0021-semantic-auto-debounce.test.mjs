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
function setup(rt,scope='A',x=10){
 for(const [id,source] of [['x',`x:=${x}`],['f','f(t):=t^2+3t'],['call','f(x)']])
  rt.addBlock({id:`${scope}-${id}`,type:'formula',taskId:scope,source});
}
const make=()=>new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'doc');
const tick=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
function clock(){
 let now=0,seq=0;const jobs=new Map();
 return {
  scheduleDelay(fn,ms){const id=++seq;jobs.set(id,{at:now+ms,fn});return id;},
  cancelDelay(id){jobs.delete(id);},
  advance(ms){now+=ms;while(true){const ready=[...jobs].filter(([,v])=>v.at<=now).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);if(!ready.length)break;const [id,v]=ready[0];jobs.delete(id);v.fn();}},
  get size(){return jobs.size;},
 };
}
function engine(visits){return ({snapshot,cachedOutcomes,revision,taskId})=>{
 const run=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
 return async task=>{visits.push([taskId,task.blockId]);return run(task);};
};}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
function scheduler(rt,c,visits,outcomes=[]){return createSemanticAutoScheduler({runtime:rt,createEvaluate:engine(visits),delayMs:40,
 scheduleDelay:c.scheduleDelay,cancelDelay:c.cancelDelay,onOutcome:(...args)=>outcomes.push(args)});}

test('S63 separate input events debounce to one final DocumentRuntime evaluation',async()=>{
 const rt=make();setup(rt);const c=clock(),visits=[],outcomes=[];
 const s=scheduler(rt,c,visits,outcomes);
 rt.setBlockSource('A-x','x:=20');c.advance(25);await tick();assert.equal(visits.length,0);
 rt.setBlockSource('A-x','x:=30');c.advance(25);await tick();assert.equal(visits.length,0);
 rt.setBlockSource('A-x','x:=3');c.advance(39);await tick();assert.equal(visits.length,0);
 c.advance(1);await tick();assert.equal(value(rt,'A-call'),'18');assert.equal(outcomes.length,1);
 assert.deepEqual(visits.map(x=>x[1]),['A-x','A-f','A-call']);s.dispose();
});

test('S63 each task owns its own debounce window',async()=>{
 const rt=make();setup(rt,'A',10);setup(rt,'B',100);const c=clock(),visits=[];
 const s=scheduler(rt,c,visits);
 rt.setBlockSource('A-x','x:=3');c.advance(20);
 rt.setBlockSource('B-x','x:=2');c.advance(20);await tick();
 assert.equal(value(rt,'A-call'),'18');assert.equal(value(rt,'B-call'),undefined);
 rt.setBlockSource('A-x','x:=4');c.advance(20);await tick();
 assert.equal(value(rt,'B-call'),'10');assert.equal(value(rt,'A-call'),undefined);
 c.advance(20);await tick();assert.equal(value(rt,'A-call'),'28');
 assert.equal(visits.filter(v=>v[0]==='A').length,5);assert.equal(visits.filter(v=>v[0]==='B').length,3);s.dispose();
});

test('S63 stale result and successful completion never reschedule a timer',async()=>{
 const rt=make();setup(rt);const c=clock(),visits=[],outcomes=[];
 const s=scheduler(rt,c,visits,outcomes);
 s.request('A');c.advance(40);await tick();assert.equal(value(rt,'A-call'),'130');assert.equal(c.size,0);
 c.advance(200);await tick();assert.equal(outcomes.length,1);assert.equal(c.size,0);s.dispose();
});

test('S63 invalid source TYPE does not schedule and dispose cancels pending timers',async()=>{
 const rt=make();setup(rt);const c=clock(),visits=[];
 const s=scheduler(rt,c,visits);
 assert.throws(()=>rt.setBlockSource('A-x',{}),/source must be a string/);assert.equal(c.size,0);
 rt.setBlockSource('A-x','x:=3');assert.equal(c.size,1);
 s.dispose();assert.equal(c.size,0);c.advance(1000);await tick();assert.equal(visits.length,0);
});

test('S63 delay contract fails closed for invalid options and zero-delay remains compatible',async()=>{
 const rt=make();setup(rt);const visits=[];
 assert.throws(()=>createSemanticAutoScheduler({runtime:rt,createEvaluate:engine(visits),delayMs:-1}),TypeError);
 assert.throws(()=>createSemanticAutoScheduler({runtime:rt,createEvaluate:engine(visits),delayMs:1.5}),TypeError);
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:engine(visits),delayMs:0});
 rt.setBlockSource('A-x','x:=20');rt.setBlockSource('A-x','x:=3');await tick();
 assert.equal(value(rt,'A-call'),'18');assert.equal(visits.length,3);s.dispose();
});

test('S63 edit after timer fires but before queued flush supersedes old request',async()=>{
 const rt=make();setup(rt);const c=clock(),visits=[],queued=[];
 const s=createSemanticAutoScheduler({runtime:rt,createEvaluate:engine(visits),delayMs:40,
  scheduleDelay:c.scheduleDelay,cancelDelay:c.cancelDelay,enqueue:fn=>queued.push(fn)});
 rt.setBlockSource('A-x','x:=20');c.advance(40);assert.equal(queued.length,1);
 rt.setBlockSource('A-x','x:=3');queued.shift()();await tick();assert.equal(visits.length,0);
 c.advance(40);assert.equal(queued.length,1);queued.shift()();await tick();
 assert.equal(value(rt,'A-call'),'18');assert.equal(visits.length,3);s.dispose();
});
