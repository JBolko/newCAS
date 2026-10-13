import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {evaluateSelectedFunctionApplication} from '../../src/js/semantics/evaluate-selected-function-application.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(operationId=>[operationId,operationSpec({operationId,evaluatorId:`probe.scalar.${operationId}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const envelope=Object.freeze({protocol:'newcas.semantic-evaluation.v1',revision:'r29',blockId:'b',taskScopeId:'task',source:'f(x)',providers:[]});
const functionFor=(source,captures=[])=>materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse(source),{writerId:'writer-f',taskScopeId:'task',specs,makeBinderId:({writerId,index})=>`${writerId}:${index}`,resolveVariable:()=>providerReference('writer-y')}),{captures});
function mockSelectedEvaluate(calls) {
 return async (_envelope,selection)=>{
  const req=selection.evaluationRequest;
  const xs=req.inputs.map(v=>BigInt(v.data.expr.value));
  const result=req.evaluatorId==='probe.scalar.add'?xs[0]+xs[1]:req.evaluatorId==='probe.scalar.multiply'?xs[0]*xs[1]:req.evaluatorId==='probe.scalar.power'?xs[0]**xs[1]:null;
  if (result===null) throw Error('unselected evaluator');
  calls.push(req.evaluatorId);
  return {status:'success',blockId:selection.blockId,value:integer(result)};
 };
}
const run=(fn,args,evaluate,s=specs,e=envelope)=>evaluateSelectedFunctionApplication({fn,args,evaluate,specs:s,envelope:e});
test('S29: f(t):=t^3+4t uses selected postorder gateway and returns 1776',async()=>{
 const calls=[];const result=await run(functionFor('f(t):=t^3+4t'),[integer(12)],mockSelectedEvaluate(calls));
 assert.equal(result.data.expr.value,'1776');assert.deepEqual(calls,['probe.scalar.power','probe.scalar.multiply','probe.scalar.add']);
});
test('S29: local x remains distinct from document argument x := 12',async()=>{
 const calls=[];const result=await run(functionFor('f(x):=x^3+4x'),[integer(12)],mockSelectedEvaluate(calls));
 assert.equal(result.data.expr.value,'1776');assert.equal(calls.length,3);
});
test('S29: explicit captures are applied before evaluator dispatch',async()=>{
 const {freeSymbolIdentity}=await import('../../src/js/semantics/identity.js');
 const captured=freeSymbolIdentity('task','y');const fn=functionFor('f(x):=x+y',[{providerId:'writer-y',identity:captured,value:integer(7)}]);
 assert.equal((await run(fn,[integer(3)],mockSelectedEvaluate([]))).data.expr.value,'10');
});
test('S29: identity application failure happens before any backend request',async()=>{
 let invoked=0;const evaluate=async()=>{invoked++;throw Error('unexpected');};
 await assert.rejects(run(functionFor('f(x):=x^3+4x'),[],evaluate),/arity/);assert.equal(invoked,0);
});
test('S29: missing selection is rejected, no silent Python fallback',async()=>{
 let invoked=0;const evaluate=async()=>{invoked++;throw Error('unexpected');};
 await assert.rejects(run(functionFor('f(x):=x^3+4x'),[integer(12)],evaluate,new Map()),/unselected arithmetic/);
 assert.equal(invoked,0);
});
test('S29: symbolic argument and unlisted provider fail closed',async()=>{
 let invoked=0;const evaluate=async()=>{invoked++;throw Error('unexpected');};
 const {freeSymbolIdentity}=await import('../../src/js/semantics/identity.js');
 const symbolic=expression({op:'symbolRef',identity:freeSymbolIdentity('task','x')});
 await assert.rejects(run(functionFor('f(x):=x^3+4x'),[symbolic],evaluate),/unresolved or unsupported/);
 await assert.rejects(run(functionFor('f(x):=x^3+4x'),[integer(12)],evaluate,specs,{...envelope,providers:[{providerId:'x',name:'x',value:integer(12)}]}),/no implicit providers/);
 assert.equal(invoked,0);
});
test('S29: identity function is pure and does not dispatch',async()=>{
 const fn=functionFor('f(x):=x');let called=false;
 const result=await run(fn,[integer(12)],async()=>{called=true;throw Error('unexpected');});
 assert.equal(result.data.expr.value,'12');assert.equal(called,false);
});
