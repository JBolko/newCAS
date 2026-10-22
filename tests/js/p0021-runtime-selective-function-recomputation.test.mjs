import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async (_envelope,selected)=>{
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const op=selected.evaluationRequest.evaluatorId;
  return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**b:op.endsWith('.multiply')?a*b:a+b)};
};
const make=()=>{
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine must not run')}},'document');
 for(const [id,source] of [['x','x:=10'],['f','f(t):=t^2+3t'],['call','f(x)']]) rt.addBlock({id,type:'formula',source,taskId:'default'});
 return rt;
};
const run=async(rt,revision,visited=[])=>rt.evaluateAndCommitDirtySemanticTask('default',{
 revision,getCurrentRevision:()=>revision,
 createEvaluate:({snapshot,cachedOutcomes})=>{
  const base=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision,cachedOutcomes});
  return async task=>{visited.push(task.blockId);return base(task);};
 },
});
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;

test('S53 fresh document calculates writer, function and call',async()=>{
 const rt=make(),visited=[];
 const result=await run(rt,'r1',visited);
 assert.equal(result.kind,'complete');
 assert.deepEqual(visited,['x','f','call']);
 assert.equal(value(rt,'call'),'130');
});
test('S53 x edit only evaluates x and f(x), reusing exact cached FunctionValue',async()=>{
 const rt=make();await run(rt,'r1');
 const fn=rt.getBlock('f').calculation.result;
 rt.setBlockSource('x','x:=3');
 const visited=[];const result=await run(rt,'r2',visited);
 assert.equal(result.kind,'complete');
 assert.deepEqual(visited,['x','call']);
 assert.equal(rt.getBlock('f').calculation.result,fn);
 assert.equal(value(rt,'call'),'18');
});
test('S53 no source edit skips every successful block',async()=>{
 const rt=make();await run(rt,'r1');
 const visited=[];const result=await run(rt,'r2',visited);
 assert.equal(result.kind,'complete');assert.deepEqual(visited,[]);
 assert.equal(value(rt,'call'),'130');
});
test('S53 modified function forces function and call, but not x',async()=>{
 const rt=make();await run(rt,'r1');
 rt.setBlockSource('f','f(t):=2t+1');
 const visited=[];const result=await run(rt,'r2',visited);
 assert.equal(result.kind,'complete');
 assert.deepEqual(visited,['f','call']);
 assert.equal(value(rt,'call'),'21');
});
test('S53 stale revision must not commit selective recomputation',async()=>{
 const rt=make();await run(rt,'r1');
 rt.setBlockSource('x','x:=3');
 const response=await rt.evaluateAndCommitDirtySemanticTask('default',{
   revision:'r2',getCurrentRevision:()=> 'r3',
   createEvaluate:({snapshot,cachedOutcomes})=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,revision:'r2',cachedOutcomes}),
 });
 assert.equal(response.kind,'stale');
 assert.equal(rt.getBlock('call').calculation.result,null);
});
test('S53 reject stale cached providers before any evaluation',async()=>{
 const rt=make();await run(rt,'r1');
 const {snapshot}=rt.deriveSemanticTask();
 const old=rt.getBlock('f').calculation.result;
 assert.throws(()=>createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:arithmetic,
   revision:'r2',cachedOutcomes:new Map([['f',{revision:'r1',outcome:{blockId:'f',status:'success',value:old}}]])}),/invalid or stale cached provider/);
});
test('S53 failed writer is not cached as a successful Value',async()=>{
 const rt=make();await run(rt,'r1');
 rt.setBlockSource('x','x:=1[m]'); // quantity remains unsupported; decimals now have an exact source path.
 const visited=[];const result=await run(rt,'r2',visited);
 assert.equal(result.kind,'complete');
 assert.deepEqual(visited,['x']); // call is blocked after failed x; no evaluator invocation
 assert.equal(rt.getBlock('x').calculation.status,'error');
 assert.equal(rt.getBlock('call').calculation.status,'error');
 assert.equal(rt.getBlock('call').calculation.result,null);
});
