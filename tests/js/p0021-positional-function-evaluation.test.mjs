import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {planSemanticRecomputation} from '../../src/js/semantics/plan-semantic-recomputation.js';
import {orderSemanticRecomputation} from '../../src/js/semantics/order-semantic-recomputation.js';
import {prepareSemanticEvaluationBatch} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';
import {dispatchSemanticEvaluationBatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
import {createSourceLiteralFunctionTaskEvaluator} from '../../src/js/semantics/create-source-literal-function-task-evaluator.js';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {expression} from '../../src/js/values/value.js';

const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const b=(id,source)=>({id,source});
const initial=[b('f1','f(x):=x^2+3x'),b('ten','f(10)'),b('three','f(3)')];
const inserted=[initial[0],initial[1],b('f2','f(x):=2x+1'),initial[2]];
const removedSecond=[initial[0],initial[1],initial[2]];
const removedFirst=[initial[1],inserted[2],initial[2]];
const model=blocks=>{
 const snapshot=deriveSourceSemanticSnapshot(blocks,parse,'task');
 return {blocks,snapshot,analysis:projectSemanticDependencyAnalysis(snapshot)};
};
const base=model(initial), withSecond=model(inserted), withoutSecond=model(removedSecond), withoutFirst=model(removedFirst);
function functions(m) {
 return new Map(m.blocks.filter(b=>b.id==='f1'||b.id==='f2').map(b=>{
   const ir=compileSelectedFunctionDefinition(parse(b.source),{
     writerId:b.id,taskScopeId:'task',specs,
     resolveVariable:()=>providerReference('unused'),
     makeBinderId:({writerId,index})=>`${writerId}:binder:${index}`,
   });
   return [b.id,{blockId:b.id,status:'success',value:materializeSelectedFunctionValue(ir,{captures:[]})}];
 }));
}
const arithmetic=async (_envelope,selected)=>{
 const [a,c]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const op=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(op.endsWith('.power')?a**c:op.endsWith('.multiply')?a*c:a+c)};
};
async function call(m,id,available=functions(m),revision='r1') {
 const source=m.blocks.find(b=>b.id===id)?.source;
 const task={blockId:id,taskScopeId:'task',source,providers:[...m.analysis.bindings.get(id)].map(([name,providerId])=>({name,providerId})),upstream:m.analysis.graph.getUpstream(id)};
 const seen=[];
 const evaluator=createSourceLiteralFunctionTaskEvaluator({snapshot:m.snapshot,blockId:id,expectedName:'f',parse,specs,evaluate:async (...args)=>{seen.push(args);return arithmetic(...args);},getProviderOutcome:providerId=>available.get(providerId),revision});
 const result=await dispatchSemanticEvaluationBatch({tasks:[task],cycles:[],blocked:[]},{revision,getCurrentRevision:()=>revision,evaluate:evaluator,cachedOutcomes:new Map([...available].map(([id,outcome])=>[id,{revision,outcome}]))});
 return {outcome:result.state.outcomes[0],kind:result.kind,missingProvider:result.providerId,seen:seen.length};
}
const number=outcome=>outcome.value.data.expr.value;
test('S43: initial source calls evaluate through individually selected f1 Value',async()=>{
 assert.equal(number((await call(base,'ten')).outcome),'130');
 assert.equal(number((await call(base,'three')).outcome),'18');
});
test('S43: inserted f2 evaluates later call to 7 but leaves earlier call 130',async()=>{
 assert.equal(number((await call(withSecond,'ten')).outcome),'130');
 assert.equal(number((await call(withSecond,'three')).outcome),'7');
});
test('S43: removal of f2 restores old f1 evaluation to 18',async()=>{
 assert.equal(number((await call(withoutSecond,'three')).outcome),'18');
 const plan=planSemanticRecomputation(withSecond.analysis,withoutSecond.analysis,[]);
 assert.deepEqual([...plan.recompute],['three']);
});
test('S43: removal of first writer invalidates f(10), old success cannot survive',async()=>{
 const result=await call(withoutFirst,'ten');
 assert.equal(result.outcome.status,'failure');
 assert.equal(result.seen,0);
 assert.match(result.outcome.message,/no uniquely selected document function provider/);
 assert.equal(number((await call(withoutFirst,'three')).outcome),'7');
});
test('S43: planning deletion of first writer recomputes only f(10)',()=>{
 const plan=planSemanticRecomputation(withSecond.analysis,withoutFirst.analysis,[]);
 assert.deepEqual([...plan.removed],['f1']);
 assert.deepEqual([...plan.recompute],['ten']);
 const schedule=orderSemanticRecomputation(withoutFirst.analysis,plan);
 const batch=prepareSemanticEvaluationBatch(withoutFirst.snapshot,withoutFirst.analysis,schedule,new Map(withoutFirst.blocks.map(b=>[b.id,b.source])),['f2','three']);
 assert.deepEqual(batch.tasks.map(t=>t.blockId),['ten']);
});
test('S43: removed or mismatched provider is rejected, no name-based fallback',async()=>{
 const onlyF2=new Map([['f2',functions(withSecond).get('f2')]]);
 const outcome=await call(withSecond,'ten',onlyF2);
 assert.equal(outcome.kind,'missing-upstream');
 assert.equal(outcome.missingProvider,'f1');
 assert.equal(outcome.seen,0);
});
test('S43: noninteger arguments are rejected before mathematical dispatch',async()=>{
 const m=model([inserted[0],b('ten','f(1.5)')]);
 const result=await call(m,'ten');
 assert.equal(result.outcome.status,'failure');assert.equal(result.seen,0);
});
