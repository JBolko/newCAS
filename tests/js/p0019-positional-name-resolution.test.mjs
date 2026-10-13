import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePositionalName } from '../../src/js/semantics/resolve-positional-name.js';
import { LexicalIdentityScope, operationLocalIdentity, binderIdentity } from '../../src/js/semantics/identity.js';
const w=(writerId,name,position,taskScopeId='t1',established=true)=>
  ({writerId,name,position,taskScopeId,established});
const lookup=(name,position,writers,opts={})=>
  resolvePositionalName({name,position,taskScopeId:'t1',writers,...opts});

test('P0019 4: nearest prior established writer, not most recently executed',()=>{
 const result=lookup('x',5,[w('new','x',4),w('old','x',0)]);
 assert.equal(result.kind,'provider-reference');
 assert.equal(result.providerId,'new');
});
test('P0019 4: current and future writers cannot bind the same occurrence',()=>{
 assert.equal(lookup('x',2,[w('now','x',2),w('later','x',3)]).kind,'semantic-reference');
});
test('P0019 4: unavailable preceding writer never falls back to previous writer',()=>{
 const writers=[{...w('broken','x',3),available:false},w('old','x',1)];
 assert.equal(lookup('x',4,writers).providerId,'broken');
});
test('P0019 4: structurally invalid writer is not established',()=>{
 assert.equal(lookup('x',5,[w('invalid','x',4,'t1',false),w('old','x',1)]).providerId,'old');
});
test('P0019 4: task boundaries remain isolated',()=>{
 assert.equal(lookup('x',5,[w('other','x',4,'t2')]).kind,'semantic-reference');
});
test('P0019 4: operation target shadows document writer',()=>{
 const scope=new LexicalIdentityScope('t1').push([operationLocalIdentity('op:x','x')]);
 const result=lookup('x',5,[w('prior','x',3)],{lexicalScope:scope});
 assert.equal(result.kind,'semantic-reference');
 assert.equal(result.identity.kind,'operation-local');
 assert.equal(result.identity.id,'op:x');
});
test('P0019 4: lexical binder shadows both document writer and operation target',()=>{
 const scope=new LexicalIdentityScope('t1')
   .push([operationLocalIdentity('op:x','x')])
   .push([binderIdentity('binder:x','x')]);
 assert.equal(lookup('x',5,[w('prior','x',3)],{lexicalScope:scope}).identity.id,'binder:x');
});
test('P0019 4: free source symbol gets task identity when no writer exists',()=>{
 const result=lookup('z',5,[]);
 assert.equal(result.identity.kind,'free-symbol');
 assert.equal(result.identity.taskScopeId,'t1');
 assert.equal(result.identity.name,'z');
});
test('P0019 4: insertion between provider and occurrence changes binding deterministically',()=>{
 const before=lookup('x',10,[w('old','x',1)]);
 const after=lookup('x',10,[w('new','x',7),w('old','x',1)]);
 assert.equal(before.providerId,'old');
 assert.equal(after.providerId,'new');
});
test('P0019 4: provider binding is independent of cached Value or failures',()=>{
 const failed={...w('writer','A',2),status:'error',value:null};
 const succeeded={...w('writer','A',2),status:'success',value:{x:42}};
 assert.deepEqual(lookup('A',3,[failed]),lookup('A',3,[succeeded]));
});
