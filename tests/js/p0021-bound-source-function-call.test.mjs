import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBoundSourceFunctionCall} from '../../src/js/semantics/evaluate-bound-source-function-call.js';
import {expression} from '../../src/js/values/value.js';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const fn=materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse('f(x):=x^3+4x'),{
 writerId:'new-f',taskScopeId:'t',specs,makeBinderId:({index})=>`b${index}`,resolveVariable:()=>providerReference('never'),
}),{captures:[]});
const call=(providerId='new-f',name='f',classification='document-writer',candidates=['document-writer'])=>({name,providerId,classification,candidates});
const snapshot=(c=call())=>({taskScopeId:'t',blocks:[{blockId:'consumer',calls:[c]}]});
const envelope=(id='new-f',value=fn)=>({protocol:'newcas.semantic-evaluation.v1',revision:'r31',blockId:'consumer',taskScopeId:'t',source:'f(x)',providers:[{name:'f',providerId:id,value}]});
const evaluator=async (_env,selected)=>{
 const req=selected.evaluationRequest;const [a,b]=req.inputs.map(v=>BigInt(v.data.expr.value));
 const n=req.evaluatorId.endsWith('.power')?a**b:req.evaluatorId.endsWith('.multiply')?a*b:a+b;
 return {status:'success',blockId:selected.blockId,value:integer(n)};
};
const run=(changes={})=>evaluateBoundSourceFunctionCall({snapshot:snapshot(),blockId:'consumer',callIndex:0,expectedName:'f',args:[integer(12)],envelope:envelope(),specs,evaluate:evaluator,...changes});
test('S31: analyzed source callable provider evaluates f(12) as 1776',async()=>{
 assert.equal((await run()).data.expr.value,'1776');
});
test('S31: nearest established writer is authoritative; no fallback to old function',async()=>{
 await assert.rejects(run({snapshot:snapshot(call('new-f')),envelope:envelope('old-f')}),/attestation/);
 await assert.rejects(run({snapshot:snapshot(call('new-f')),envelope:envelope('new-f',integer(17))}),/FunctionValue/);
});
test('S31: catalog collision is explicit ambiguity, never name priority',async()=>{
 await assert.rejects(run({snapshot:snapshot(call('new-f','f','ambiguous',['operation','document-writer']))}),/ambiguous/);
});
test('S31: no future writer or unknown callable can be guessed',async()=>{
 await assert.rejects(run({snapshot:snapshot(call(null,'f','unresolved',[]))}),/uniquely selected/);
});
test('S31: block and task scope must match exact source analysis',async()=>{
 await assert.rejects(run({blockId:'different'}),/source block/);
 await assert.rejects(run({envelope:{...envelope(),taskScopeId:'elsewhere'}}),/attestation/);
});
test('S31: call occurrence and selected source spelling are attested',async()=>{
 await assert.rejects(run({callIndex:1}),/occurrence/);
 await assert.rejects(run({expectedName:'g'}),/occurrence/);
});
test('S31: incorrect extra provider cannot leak into function evaluation',async()=>{
 const env=envelope();env.providers.push({name:'x',providerId:'writer-x',value:integer(12)});
 await assert.rejects(run({envelope:env}),/attestation/);
});
