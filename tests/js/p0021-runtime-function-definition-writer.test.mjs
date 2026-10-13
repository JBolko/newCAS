import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createSourceFunctionDefinitionTaskEvaluator} from '../../src/js/semantics/create-source-function-definition-task-evaluator.js';
import {applySelectedFunctionValue} from '../../src/js/semantics/apply-selected-function-value.js';
import {expression,isValue} from '../../src/js/values/value.js';
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(op=>[op,operationSpec({operationId:op,evaluatorId:`probe.${op}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
function setup(source='f(x):=x^2+3x') {
 const rt=new DocumentRuntime({calculate:async()=>{throw Error('legacy CASEngine must not run')}},'doc');
 rt.addBlock({id:'f',type:'formula',source,taskId:'default'});
 const {snapshot}=rt.deriveSemanticTask();
 const writer=createSourceFunctionDefinitionTaskEvaluator({snapshot,blockId:'f',expectedName:'f',parse,specs,
  getProviderOutcome:()=>null,revision:'r1'});
 return {rt,snapshot,writer};
}
test('S50 document runtime source produces immutable FunctionValue and commits to its own calculation state',async()=>{
 const {rt,writer}=setup();
 const result=await rt.evaluateAndCommitSemanticTask('default',{revision:'r1',getCurrentRevision:()=> 'r1',evaluate:writer});
 assert.equal(result.kind,'complete');
 const calc=rt.getBlock('f').calculation;
 assert.equal(calc.status,'success');assert.equal(calc.result.kind,'function');assert.ok(isValue(calc.result));
 assert.equal(calc.result.data.parameters.length,1);
 assert.equal(applySelectedFunctionValue(calc.result,[integer(10)]).data.expr.op,'add');
});
test('S50 source change after snapshot cannot silently materialize different named definition',async()=>{
 const {writer}=setup();
 await assert.rejects(()=>writer({blockId:'f',taskScopeId:'default',source:'g(x):=x^2',providers:[],upstream:[]}),/source function writer/);
});
test('S50 source free capture fails closed instead of reading implicit globals',async()=>{
 const {rt}=setup('f(x):=x+y'); const {snapshot}=rt.deriveSemanticTask();
 const writer=createSourceFunctionDefinitionTaskEvaluator({snapshot,blockId:'f',expectedName:'f',parse,specs,getProviderOutcome:()=>null,revision:'r1'});
 await assert.rejects(()=>writer({blockId:'f',taskScopeId:'default',source:'f(x):=x+y',providers:[],upstream:[]}),/capture provider/);
});
test('S50 rejects provider injection and cross-task envelopes',async()=>{
 const {writer}=setup();
 const base={blockId:'f',taskScopeId:'default',source:'f(x):=x^2+3x',providers:[],upstream:[]};
 await assert.rejects(()=>writer({...base,taskScopeId:'other'}),/task identity mismatch/);
 const rejected=await writer({...base,providers:[{name:'x',providerId:'x'}],upstream:['x']});
 assert.equal(rejected.status,'failure');assert.equal(rejected.code,'PROVIDER_UNAVAILABLE');
});
test('S50 source writer is positional: a later redefinition cannot replace an earlier writer',async()=>{
 const {rt,writer}=setup();rt.addBlock({id:'f2',type:'formula',source:'f(x):=2x+1',taskId:'default'});
 const outcome=await writer({blockId:'f',taskScopeId:'default',source:'f(x):=x^2+3x',providers:[],upstream:[]});
 assert.equal(outcome.status,'success');assert.equal(outcome.value.kind,'function');
});
