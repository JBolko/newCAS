import test from 'node:test';
import assert from 'node:assert/strict';
import {createValueEvaluator} from '../../src/js/semantics/create-value-evaluator.js';
import {dispatchSemanticEvaluationBatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
const value = {kind:'IntegerValue',value:3};
const success=(id,v=value)=>({blockId:id,status:'success',value:v});
const task=(id,providers=[],upstream=providers.map(p=>p.providerId))=>({blockId:id,taskScopeId:'T',source:`${id} := 1`,providers,upstream});
const setup=(invoke=async r=>success(r.blockId),reader=()=>null)=>createValueEvaluator({invoke,getProviderOutcome:reader,revision:'r1'});
test('S7 emits a frozen structured-clone-friendly protocol envelope',async()=>{
 let req;const evalTask=setup(async r=>{req=r;return success(r.blockId)});
 await evalTask(task('a'));assert.equal(req.protocol,'newcas.semantic-evaluation.v1');assert.equal(req.revision,'r1');
 assert.deepEqual(req.providers,[]);assert.ok(Object.isFrozen(req));assert.deepEqual(structuredClone(req),req);
});
test('S7 forwards exact provider IDs and Values, not Python scope lookups',async()=>{
 let req;const evalTask=setup(async r=>{req=r;return success(r.blockId)},id=>success(id));
 await evalTask(task('b',[{name:'a',providerId:'writer-42'}],['writer-42']));
 assert.deepEqual(req.providers,[{name:'a',providerId:'writer-42',value}]);
});
test('S7 immutable detached provider data',async()=>{
 const v={kind:'IntegerValue',value:3};let req;
 await setup(async r=>{req=r;return success(r.blockId)},id=>success(id,v))(task('b',[{name:'a',providerId:'a'}]));
 v.value=9;assert.equal(req.providers[0].value.value,3);assert.ok(Object.isFrozen(req.providers[0].value));
});
test('S7 missing provider fails closed without backend call',async()=>{
 let calls=0;const result=await setup(async()=>{calls++;return success('b')})(task('b',[{name:'a',providerId:'a'}]));
 assert.equal(result.code,'PROVIDER_UNAVAILABLE');assert.equal(calls,0);
});
test('S7 wrong-ID success fails closed',async()=>{
 const result=await setup(async()=>success('b'),()=>success('other'))(task('b',[{name:'a',providerId:'a'}]));
 assert.equal(result.code,'PROVIDER_UNAVAILABLE');
});
test('S7 failed provider cannot become a Value',async()=>{
 const result=await setup(async()=>success('b'),()=>({blockId:'a',status:'failure',code:'E',message:'x'}))(task('b',[{name:'a',providerId:'a'}]));
 assert.equal(result.code,'PROVIDER_UNAVAILABLE');
});
test('S7 rejects nonportable cyclic Value',async()=>{
 const v={kind:'ExpressionValue'};v.self=v;
 const result=await setup(async()=>success('b'),()=>success('a',v))(task('b',[{name:'a',providerId:'a'}]));
 assert.equal(result.code,'PROVIDER_UNAVAILABLE');
});
test('S7 rejects malformed duplicate provider names',async()=>{
 await assert.rejects(setup(undefined,id=>success(id))(task('b',[{name:'a',providerId:'one'},{name:'a',providerId:'two'}])),TypeError);
});
test('S7 rejects provider outside declared upstream graph',async()=>{
 await assert.rejects(setup()(task('b',[{name:'a',providerId:'a'}],[])),TypeError);
});
test('S7 backend failures remain exception for existing dispatcher normalization',async()=>{
 await assert.rejects(setup(async()=>{throw Error('Pyodide unavailable')})(task('a')),/Pyodide unavailable/);
});
test('S7 integrates with real Slice 6 dispatcher for independent evaluation',async()=>{
 const seen=[];const evaluate=setup(async r=>{seen.push(r.blockId);return success(r.blockId)});
 const out=await dispatchSemanticEvaluationBatch({tasks:[task('a')],cycles:[],blocked:[]},{revision:'r1',getCurrentRevision:()=> 'r1',evaluate});
 assert.equal(out.kind,'complete');assert.deepEqual(seen,['a']);
});
test('S7 rejects nonportable provider values such as functions',async()=>{
 const out=await setup(async()=>success('b'),()=>success('a',{kind:'X',callback:()=>42}))(task('b',[{name:'a',providerId:'a'}]));
 assert.equal(out.code,'PROVIDER_UNAVAILABLE');
});
