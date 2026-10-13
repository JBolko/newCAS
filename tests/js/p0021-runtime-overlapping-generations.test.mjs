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
function document(){const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy engine invoked');}},'document');for(const [id,source] of [['x','x:=10'],['f','f(t):=t^2+3t'],['call','f(x)']])rt.addBlock({id,type:'formula',source,taskId:'default'});return rt;}
function run(rt,revision,{pause,visits=[],getCurrentRevision=()=>revision}={}){
 let stopped=false;
 return rt.evaluateAndCommitDirtySemanticTask('default',{revision,getCurrentRevision,createEvaluate:({snapshot,cachedOutcomes})=>{
  const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
  return async task=>{visits.push(task.blockId);if(pause&&!stopped&&task.blockId==='call'){stopped=true;pause.enter();await pause.pending;}return base(task);};
 }});
}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;

test('S56 older in-flight round cannot overwrite newer committed result',async()=>{
 const rt=document();const old=gate(),oldVisits=[],newVisits=[];
 const first=run(rt,'r1',{pause:old,visits:oldVisits});await old.entered;
 rt.setBlockSource('x','x:=3');
 const second=await run(rt,'r2',{visits:newVisits});
 assert.equal(second.kind,'complete');assert.equal(value(rt,'call'),'18');
 assert.equal(value(rt,'x'),'3');assert.equal(rt.getBlock('f').calculation.status,'success');
 old.release();assert.equal((await first).kind,'stale');
 assert.equal(value(rt,'call'),'18');assert.equal(value(rt,'x'),'3');
 assert.deepEqual(newVisits,['x','f','call']);
});

test('S56 revision-only supersession rejects older result even without document edits',async()=>{
 const rt=document(),g=gate();let active='r1';
 const old=run(rt,'r1',{pause:g,getCurrentRevision:()=>active});await g.entered;
 active='r2';assert.equal((await run(rt,'r2',{getCurrentRevision:()=>active})).kind,'complete');
 assert.equal(value(rt,'call'),'130');g.release();assert.equal((await old).kind,'stale');assert.equal(value(rt,'call'),'130');
});

test('S56 two overlapping rounds with inverse completion preserve newest value and no retry',async()=>{
 const rt=document(),g1=gate(),g2=gate();let calls1=0,calls2=0;
 const r1=run(rt,'r1',{pause:g1,visits:[]});await g1.entered;
 rt.setBlockSource('x','x:=3');
 const r2=run(rt,'r2',{pause:g2,visits:[]});await g2.entered;
 g2.release();assert.equal((await r2).kind,'complete');assert.equal(value(rt,'call'),'18');
 g1.release();assert.equal((await r1).kind,'stale');assert.equal(value(rt,'call'),'18');
 assert.equal(rt.getBlock('call').calculation.status,'success');
});

test('S56 generation/source guard rejects older same-revision round after edit',async()=>{
 const rt=document(),oldGate=gate();const old=run(rt,'shared',{pause:oldGate});await oldGate.entered;
 rt.setBlockSource('x','x:=3');
 assert.equal((await run(rt,'shared')).kind,'complete');assert.equal(value(rt,'call'),'18');
 oldGate.release();assert.equal((await old).kind,'stale');assert.equal(value(rt,'call'),'18');
});
