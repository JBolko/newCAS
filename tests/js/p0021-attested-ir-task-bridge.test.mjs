import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttestedIRTaskEvaluator} from '../../src/js/semantics/create-attested-ir-task-evaluator.js';
import {expression} from '../../src/js/values/value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
const v=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const arithmetic=async (_env,selected)=>{
 const [a,b]=selected.evaluationRequest.inputs.map(x=>BigInt(x.data.expr.value));
 const op=selected.evaluationRequest.evaluatorId;
 return {blockId:selected.blockId,status:'success',value:v(op.endsWith('add')?a+b:op.endsWith('multiply')?a*b:a**b)};
};
const literal=n=>({type:'Literal',value:n});
const variable=name=>({type:'Variable',name});
const binary=(op,left,right)=>({type:'BinaryExpression',op,left,right});
const ref=(name,providerId)=>({name,binding:{kind:'provider-reference',providerId}});
const task=(source,providers=[],upstream=[])=>({blockId:'out',taskScopeId:'A',source,providers,upstream});
function setup({source,statement,references=[],writers=[],providerOutcomes={}}){
 const snapshot={taskScopeId:'A',writers,blocks:[{blockId:'out',parseError:null,references,calls:[]}]};
 const runner=createAttestedIRTaskEvaluator({snapshot,blockId:'out',parse:()=>[statement],specs,evaluate:arithmetic,
   applyFunction:async()=>{throw Error('unexpected callable');},getProviderOutcome:id=>providerOutcomes[id]??null,revision:'rev'});
 return runner(task(source,references.map(r=>({name:r.name,providerId:r.binding.providerId})),references.map(r=>r.binding.providerId)));
}
const result=(blockId,value)=>({blockId,status:'success',value});
test('P0020-bound a*b+1 executes through IR and gateway Value',async()=>{
 const outcome=await setup({source:'a*b+1',statement:binary('+',binary('*',variable('a'),variable('b')),literal(1)),
   references:[ref('a','A'),ref('b','B')],providerOutcomes:{A:result('A',v(2)),B:result('B',v(3))}});
 assert.equal(outcome.status,'success');assert.equal(outcome.value.data.expr.value,'7');
});
test('assignment writer is attested, not inferred from its source',async()=>{
 const statement={type:'Assignment',name:'c',value:binary('+',variable('ab'),literal(1))};
 const options={source:'c:=ab+1',statement,references:[ref('ab','AB')],providerOutcomes:{AB:result('AB',v(11))}};
 await assert.rejects(setup(options),/unattested writer/);
 const outcome=await setup({...options,writers:[{name:'c',writerId:'out'}]});
 assert.equal(outcome.value.data.expr.value,'12');
});
test('unavailable provider produces failure outcome, never a fallback',async()=>{
 const outcome=await setup({source:'a',statement:variable('a'),references:[ref('a','A')]});
 assert.equal(outcome.status,'failure');assert.equal(outcome.code,'PROVIDER_UNAVAILABLE');
});
test('mismatched provider identity is rejected at gateway boundary',async()=>{
 const snapshot={taskScopeId:'A',writers:[],blocks:[{blockId:'out',parseError:null,references:[ref('a','A')],calls:[]}]};
 const runner=createAttestedIRTaskEvaluator({snapshot,blockId:'out',parse:()=>[variable('a')],specs,evaluate:arithmetic,
   applyFunction:async()=>v(1),getProviderOutcome:()=>result('B',v(8)),revision:'rev'});
 assert.equal((await runner(task('a',[{name:'a',providerId:'A'}],['A']))).status,'failure');
});
test('nested f(g(4)) retains attested callable identities through gateway',async()=>{
 const {functionValue}=await import('../../src/js/values/value.js');
 const {binderIdentity}=await import('../../src/js/semantics/identity.js');
 const f=functionValue([{identity:binderIdentity('f-arg','t')}],v(0));
 const g=functionValue([{identity:binderIdentity('g-arg','t')}],v(0));
 const snapshot={taskScopeId:'A',writers:[],blocks:[{blockId:'out',parseError:null,references:[],calls:[
  {name:'f',classification:'document-writer',candidates:['document-writer'],providerId:'F'},
  {name:'g',classification:'document-writer',candidates:['document-writer'],providerId:'G'}]}]};
 const statement={type:'FunctionCall',name:'f',args:[{type:'FunctionCall',name:'g',args:[literal(4)]}]};
 const seen=[];
 const runner=createAttestedIRTaskEvaluator({snapshot,blockId:'out',parse:()=>[statement],specs,evaluate:arithmetic,
  applyFunction:async ({fn,args})=>{const isG=fn.data.parameters[0].identity.id==='g-arg';seen.push(isG?'g':'f');const x=BigInt(args[0].data.expr.value);return v(isG?x*3n:x*x+2n);},
  getProviderOutcome:id=>id==='F'?result('F',f):id==='G'?result('G',g):null,revision:'rev'});
 const outcome=await runner(task('f(g(4))',[{name:'f',providerId:'F'},{name:'g',providerId:'G'}],['F','G']));
 assert.equal(outcome.value.data.expr.value,'146');assert.deepEqual(seen,['g','f']);
});
