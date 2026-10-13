import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyBlockCallTargets} from '../../src/js/semantics/classify-call-targets.js';
const writer=(writerId,name,position,taskScopeId='t')=>({writerId,name,position,taskScopeId,established:true});
const analyze=(calls,writers=[],position=3,taskScopeId='t')=>({
 taskScopeId, writers,
 entries:[{blockId:'at',position,ast:[{type:'FunctionCall'}],parseError:null}],
});
const derived=calls=>({taskScopeId:'t',blocks:[{blockId:'at',callTargets:calls,parseError:null}]});
const check=(calls,writers=[],pos=3)=>classifyBlockCallTargets(analyze(calls,writers,pos),derived(calls)).blocks[0].calls;

test('catalog operation remains an operation candidate',()=>{
 const [c]=check(['tangentline']); assert.equal(c.classification,'operation');
 assert.deepEqual(c.candidates,['operation']);
});
test('document function is a writer candidate',()=>{
 const [c]=check(['f'],[writer('f1','f',1)]);
 assert.equal(c.classification,'document-writer');assert.equal(c.providerId,'f1');
});
test('collision is explicit ambiguity rather than automatic priority',()=>{
 const [c]=check(['tangentline'],[writer('user1','tangentline',1)]);
 assert.equal(c.classification,'ambiguous');
 assert.deepEqual(c.candidates,['operation','document-writer']);
});
test('unresolved callable remains unresolved',()=>{
 const [c]=check(['unknown']); assert.equal(c.classification,'unresolved');
});
test('future writer is not a candidate',()=>{
 const [c]=check(['f'],[writer('f_future','f',4)]);
 assert.equal(c.classification,'unresolved');
});
test('nearest prior writer selected even if previous writer exists',()=>{
 const [c]=check(['f'],[writer('old','f',1),writer('new','f',2)]);
 assert.equal(c.providerId,'new');
});
test('writer from other task is not a candidate',()=>{
 const [c]=check(['f'],[writer('other','f',1,'other-task')]);
 assert.equal(c.classification,'unresolved');
});
test('multiple calls preserve order and output is immutable',()=>{
 const result=classifyBlockCallTargets(analyze(['tangentline','f'],[writer('f1','f',1)]),derived(['tangentline','f']));
 assert.deepEqual(result.blocks[0].calls.map(c=>c.name),['tangentline','f']);
 assert.ok(Object.isFrozen(result.blocks[0].calls));
 assert.ok(Object.isFrozen(result.blocks[0].calls[0].candidates));
});
test('invalid input and missing block are rejected',()=>{
 assert.throws(()=>classifyBlockCallTargets(null,derived([])),TypeError);
 assert.throws(()=>classifyBlockCallTargets(analyze([]),{taskScopeId:'t',blocks:[{blockId:'not-present',callTargets:[]}]}),TypeError);
});
