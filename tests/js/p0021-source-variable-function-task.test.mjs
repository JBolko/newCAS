import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {prepareSemanticEvaluationBatch} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';
import {dispatchSemanticEvaluationBatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
import {createSourceVariableFunctionTaskEvaluator} from '../../src/js/semantics/create-source-variable-function-task-evaluator.js';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {expression} from '../../src/js/values/value.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const fn=materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse('f(t):=t^3+4t'),{
 writerId:'f',taskScopeId:'task',specs,makeBinderId:({index})=>`binder-${index}`,resolveVariable:()=>providerReference('unknown')
}),{captures:[]});
const blocks=(x='12',call='f(x)')=>[{id:'x',source:`x:=${x}`},{id:'f',source:'f(t):=t^3+4t'},{id:'call',source:call}];
const evaluate=async(_envelope,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
 const id=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
const build=(x='12',call='f(x)')=>{
 const sources=blocks(x,call),snapshot=deriveSourceSemanticSnapshot(sources,parse,'task');
 const analysis=projectSemanticDependencyAnalysis(snapshot);
 const taskBatch=prepareSemanticEvaluationBatch(snapshot,analysis,{order:['call'],cycles:[],blocked:[]},new Map(sources.map(b=>[b.id,b.source])),['x','f']);
 const revision=`r-${x}`;
 const results=new Map([['x',{blockId:'x',status:'success',value:integer(x)}],['f',{blockId:'f',status:'success',value:fn}]]);
 const getProviderOutcome=id=>results.get(id);
 const dispatcher=createSourceVariableFunctionTaskEvaluator({snapshot,blockId:'call',expectedName:'f',parse,specs,evaluate,getProviderOutcome,revision});
 const cache=new Map([...results].map(([id,outcome])=>[id,{revision,outcome}]));
 return {snapshot,taskBatch,dispatcher,cache,revision,results};
};
async function run(env){return dispatchSemanticEvaluationBatch(env.taskBatch,{revision:env.revision,getCurrentRevision:()=>env.revision,evaluate:env.dispatcher,cachedOutcomes:env.cache});}
test('S40: P0020 document bindings produce f(document x:=12) = 1776',async()=>{
 const env=build();assert.deepEqual(env.taskBatch.tasks[0].providers.map(p=>p.name).sort(),['f','x']);
 const result=await run(env);assert.equal(result.kind,'complete');assert.equal(result.state.outcomes[0].value.data.expr.value,'1776');
});
test('S40: same document binds changed x:=3 and evaluates 39',async()=>{
 const result=await run(build('3'));assert.equal(result.state.outcomes[0].value.data.expr.value,'39');
});
test('S40: changed provider value is read from current outcome, never hardcoded args',async()=>{
 const env=build();env.results.set('x',{blockId:'x',status:'success',value:integer(3)});
 const result=await run(env);assert.equal(result.state.outcomes[0].value.data.expr.value,'39');
});
test('S40: unavailable argument provider prevents evaluation',async()=>{
 const env=build();env.results.delete('x');
 const result=await run(env);assert.equal(result.state.outcomes[0].status,'failure');
});
test('S40: wrong current provider type fails closed',async()=>{
 const env=build();env.results.set('f',{blockId:'f',status:'success',value:integer(7)});
 const result=await run(env);assert.equal(result.state.outcomes[0].status,'failure');
});
test('S40: source with nonvariable argument not silently reinterpreted',async()=>{
 const env=build('12','f(12)');const result=await run(env);assert.equal(result.state.outcomes[0].status,'failure');
});
test('S40: stale revision prevents computation',async()=>{
 const env=build();let calls=0;
 const result=await dispatchSemanticEvaluationBatch(env.taskBatch,{revision:env.revision,getCurrentRevision:()=> 'new-revision',evaluate:async task=>{calls++;return env.dispatcher(task);},cachedOutcomes:env.cache});
 assert.equal(result.kind,'stale');assert.equal(calls,0);
});
