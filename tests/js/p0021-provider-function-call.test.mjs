import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {evaluateProviderFunctionCall} from '../../src/js/semantics/evaluate-provider-function-call.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(operationId=>[operationId,operationSpec({operationId,evaluatorId:`probe.scalar.${operationId}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const makeFn=(src='f(x):=x^3+4x')=>materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse(src),{
 writerId:'writer-f',taskScopeId:'task',specs,makeBinderId:({index})=>`binder-${index}`,resolveVariable:()=>providerReference('unknown'),
}),{captures:[]});
const base={protocol:'newcas.semantic-evaluation.v1',revision:'r30',blockId:'caller',taskScopeId:'task',source:'f(x)',providers:[]};
const envelope=(fn=makeFn())=>({...base,providers:[{name:'f',providerId:'writer-f',value:fn}]});
const mock=calls=>async (env,selection)=>{
 assert.equal(env.providers.length,0,'callable provider cannot leak into arithmetic');
 const req=selection.evaluationRequest;
 const [a,b]=req.inputs.map(v=>BigInt(v.data.expr.value));
 const v=req.evaluatorId==='probe.scalar.power'?a**b:req.evaluatorId==='probe.scalar.multiply'?a*b:req.evaluatorId==='probe.scalar.add'?a+b:null;
 if(v===null) throw Error('unknown selected evaluator');
 calls.push(req.evaluatorId);
 return {status:'success',blockId:selection.blockId,value:integer(v)};
};
const run=(extra={})=>evaluateProviderFunctionCall({providerId:'writer-f',args:[integer(12)],envelope:envelope(),specs,evaluate:mock([]),...extra});
test('S30: exact provider writer-f + materialized document x=12 returns 1776',async()=>{
 const calls=[];const result=await run({evaluate:mock(calls)});
 assert.equal(result.data.expr.value,'1776');
 assert.deepEqual(calls,['probe.scalar.power','probe.scalar.multiply','probe.scalar.add']);
});
test('S30: same display name x on document and binder does not capture',async()=>{
 const result=await run({args:[integer(3)]});
 assert.equal(result.data.expr.value,'39');
});
test('S30: selected provider identity must match exactly; no name lookup',async()=>{
 let dispatched=false;
 await assert.rejects(run({providerId:'writer-other',evaluate:async()=>{dispatched=true;}}),/matching identity/);
 assert.equal(dispatched,false);
});
test('S30: non-FunctionValue provider is rejected before arithmetic',async()=>{
 await assert.rejects(run({envelope:envelope(integer(17))}),/FunctionValue/);
});
test('S30: extra callable/provider entries are rejected, not silently ignored',async()=>{
 const env=envelope();env.providers.push({name:'x',providerId:'writer-x',value:integer(12)});
 await assert.rejects(run({envelope:env}),/exactly one/);
});
test('S30: invalid arguments and arity fail closed',async()=>{
 await assert.rejects(run({args:[12]}),/Value arguments/);
 await assert.rejects(run({args:[]}),/arity/);
});
test('S30: upstream selected evaluator failures propagate',async()=>{
 await assert.rejects(run({evaluate:async()=>{throw Error('backend failed');}}),/backend failed/);
});
