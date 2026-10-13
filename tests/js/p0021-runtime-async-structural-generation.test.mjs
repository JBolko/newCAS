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
function makeDoc(){
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine invoked');}},'document');
 for(const [id,source] of [['first','f(x):=x^2+3x'],['ten','f(10)'],['second','f(x):=2x+1'],['three','f(3)']]) rt.addBlock({id,type:'formula',source,taskId:'default'});
 return rt;
}
function gate(){let enter,release;const entered=new Promise(resolve=>enter=resolve);const pending=new Promise(resolve=>release=resolve);return {entered,pending,enter,release};}
const result=(rt,id)=>rt.getBlock(id)?.calculation?.result?.data?.expr?.value;
function run(rt,revision,{pause,visited=[],getCurrentRevision=()=>revision}={}){
 let held=false;
 return rt.evaluateAndCommitDirtySemanticTask('default',{revision,getCurrentRevision,
  createEvaluate:({snapshot,cachedOutcomes})=>{
   const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
   return async task=>{
    visited.push(task.blockId);
    if(pause && !held && task.blockId==='ten'){
      held=true;pause.enter();await pause.pending;
    }
    return base(task);
   };
  },
 });
}

for(const [description,change,expected,changedId] of [
 ['remove first definition',rt=>rt.removeBlock('first'),{ten:null,three:'7'},'ten'],
 ['move second definition before first call',rt=>rt.moveBlock('second',1),{ten:'21',three:'7'},'ten'],
 ['edit first definition',rt=>rt.setBlockSource('first','f(x):=x^2+4x'),{ten:'140',three:'7'},'ten'],
 ['insert overriding function before first call',rt=>rt.insertBlock({id:'new',type:'formula',source:'f(x):=3x+1',taskId:'default'},1),{ten:'31',three:'7'},'ten'],
]){
 test(`S55 async ${description}: stale result never commits; explicit next run settles`,async()=>{
  const rt=makeDoc();assert.equal((await run(rt,'r1')).kind,'complete');
  assert.equal(result(rt,'ten'),'130');assert.equal(result(rt,'three'),'7');
  // Make a real pending calculation after the first success, without changing its dependencies.
  rt.markBlockDirty('ten');
  const p=gate(),visited=[];
  const awaiting=run(rt,'r2',{pause:p,visited});
  await p.entered;
  const oldGeneration=rt.getBlock('ten').calculation.generation;
  change(rt);
  assert.equal(rt.getBlock(changedId).calculation.result,null);
  p.release();
  assert.equal((await awaiting).kind,'stale');
  assert.equal(rt.getBlock('ten').calculation.result,null);
  assert.ok(rt.getBlock('ten').calculation.generation>=oldGeneration);
  // stale does not schedule itself; next pass is explicit and uses fresh bindings.
  const newVisited=[];
  assert.equal((await run(rt,'r3',{visited:newVisited})).kind,'complete');
  assert.equal(result(rt,'ten')??null,expected.ten);
  assert.equal(result(rt,'three'),expected.three);
 });
}
test('S55 async external revision mismatch does not retry or commit',async()=>{
 const rt=makeDoc();const p=gate();let current='r1',calls=0;
 const awaiting=rt.evaluateAndCommitSemanticTask('default',{revision:'r1',getCurrentRevision:()=>current,
  evaluate:async task=>{calls++;p.enter();await p.pending;return {blockId:task.blockId,status:'success',value:integer(999)};}});
 await p.entered;current='r2';p.release();
 assert.equal((await awaiting).kind,'stale');
 assert.equal(calls,1);
 assert.equal(rt.getBlock('first').calculation.result,null);
 assert.equal(rt.getBlock('first').calculation.status,'idle');
});
