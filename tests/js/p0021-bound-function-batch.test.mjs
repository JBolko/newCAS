import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoundFunctionTaskEvaluator} from '../../src/js/semantics/create-bound-function-task-evaluator.js';
import {dispatchSemanticEvaluationBatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {expression} from '../../src/js/values/value.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const fn=materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse('f(x):=x^3+4x'),{
 writerId:'writer-f',taskScopeId:'task',specs,makeBinderId:({index})=>`b${index}`,resolveVariable:()=>providerReference('never'),
}),{captures:[]});
const snapshot={taskScopeId:'task',blocks:[{blockId:'consumer',calls:[{name:'f',classification:'document-writer',candidates:['document-writer'],providerId:'writer-f'}]}]};
const task=Object.freeze({blockId:'consumer',taskScopeId:'task',source:'f(x)',providers:Object.freeze([{name:'f',providerId:'writer-f'}]),upstream:Object.freeze(['writer-f'])});
const batch=Object.freeze({tasks:Object.freeze([task]),cycles:Object.freeze([]),blocked:Object.freeze([])});
const evaluate=async (_envelope,selection)=>{
 const [a,b]=selection.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const id=selection.evaluationRequest.evaluatorId;
 return {status:'success',blockId:selection.blockId,value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
const cached=Object.freeze({revision:'r32',outcome:{blockId:'writer-f',status:'success',value:fn}});
const cache=new Map([['writer-f',cached]]);
const make=({provider=fn,providerId='writer-f',revision='r32',args=[integer(12)]}={})=>createBoundFunctionTaskEvaluator({
 snapshot,blockId:'consumer',expectedName:'f',args,specs,evaluate,revision,
 getProviderOutcome:id=>id===providerId?{blockId:id,status:'success',value:provider}:null,
});

test('S32: existing dispatcher evaluates document-attested f(12) as 1776',async()=>{
 const result=await dispatchSemanticEvaluationBatch(batch,{revision:'r32',getCurrentRevision:()=> 'r32',evaluate:make(),cachedOutcomes:cache});
 assert.equal(result.kind,'complete');
 assert.equal(result.state.outcomes[0].value.data.expr.value,'1776');
});
test('S32: wrong function provider identity cannot fall back by name',async()=>{
 const result=await dispatchSemanticEvaluationBatch(batch,{revision:'r32',getCurrentRevision:()=> 'r32',evaluate:make({providerId:'old-f'}),cachedOutcomes:cache});
 assert.equal(result.state.outcomes[0].status,'failure');
});
test('S32: failed current function provider cannot be treated as older FunctionValue',async()=>{
 const result=await dispatchSemanticEvaluationBatch(batch,{revision:'r32',getCurrentRevision:()=> 'r32',evaluate:make({provider:integer(99)}),cachedOutcomes:cache});
 assert.equal(result.state.outcomes[0].status,'failure');
});
test('S32: caller revision change before dispatch stops evaluation',async()=>{
 let calls=0;
 const result=await dispatchSemanticEvaluationBatch(batch,{revision:'r32',getCurrentRevision:()=> 'r33',evaluate:async t=>{calls++;return make()(t);},cachedOutcomes:cache});
 assert.equal(result.kind,'stale');assert.equal(calls,0);
});
test('S32: late function result cannot commit after a revision change',async()=>{
 let revision='r32';
 const result=await dispatchSemanticEvaluationBatch(batch,{revision:'r32',getCurrentRevision:()=>revision,evaluate:async t=>{
   const outcome=await make()(t);revision='r33';return outcome;
 },cachedOutcomes:cache});
 assert.equal(result.kind,'stale');
});
test('S32: task must match document block and task-scope provenance',async()=>{
 const wrong={...task,taskScopeId:'elsewhere'};
 await assert.rejects(make()(wrong),/attestation/);
 // A mismatch is rejected at the bound-source boundary, through Slice 6 failure normalization.
 const wrongBatch={tasks:[wrong],cycles:[],blocked:[]};
 const result=await dispatchSemanticEvaluationBatch(wrongBatch,{revision:'r32',getCurrentRevision:()=> 'r32',evaluate:make(),cachedOutcomes:cache});
 assert.equal(result.state.outcomes[0].status,'failure');
});
