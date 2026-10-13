import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {sameIdentity} from '../../src/js/semantics/identity.js';
const spec=(name,arity)=>operationSpec({operationId:name,evaluatorId:`probe.scalar.${name}`,arguments:Array.from({length:arity},(_,i)=>({name:`a${i}`,role:'value'}))});
const specs=new Map([['add',spec('add',2)],['multiply',spec('multiply',2)],['power',spec('power',2)]]);
const compile=(source, options={})=>compileSelectedFunctionDefinition(parse(source),{
 writerId:'writer-f',taskScopeId:'task-1',specs,
 resolveVariable:()=>providerReference('writer-x12'),
 makeBinderId:({writerId,index,name})=>`${writerId}:${index}:${name}`,...options});
test('S26 RED: f(x):=x^3+4x binds every x to function parameter, not x:=12',()=>{
 const reads=[];const ir=compile('f(x):=x^3+4x',{resolveVariable:name=>{reads.push(name);return providerReference('writer-x12')}});
 assert.equal(ir.kind,'define-function');assert.equal(ir.parameters[0].kind,'binder');
 const xPower=ir.body.args[0].args[0];
 const xMultiply=ir.body.args[1].args[1];
 assert.ok(sameIdentity(xPower.identity,ir.parameters[0]));
 assert.ok(sameIdentity(xMultiply.identity,ir.parameters[0]));
 assert.deepEqual(reads,[]);
});
test('S26 RED: free y in f(x):=x+y binds to document writer',()=>{
 const seen=[];const ir=compile('f(x):=x+y',{resolveVariable:name=>{seen.push(name);return providerReference('writer-y')}});
 assert.ok(sameIdentity(ir.body.args[0].identity,ir.parameters[0]));
 assert.equal(ir.body.args[1].providerId,'writer-y');assert.deepEqual(seen,['y']);
});
test('S26 RED: two parameters have disjoint binder identities',()=>{
 const ir=compile('f(x;y):=x+y');assert.equal(ir.parameters.length,2);
 assert.ok(sameIdentity(ir.body.args[0].identity,ir.parameters[0]));
 assert.ok(sameIdentity(ir.body.args[1].identity,ir.parameters[1]));
 assert.ok(!sameIdentity(ir.parameters[0],ir.parameters[1]));
});
test('S26 RED: malformed or duplicate function parameters fail before resolution',()=>{
 let reads=0;const args={resolveVariable:()=>{reads++;return providerReference('writer')}};
 assert.throws(()=>compileSelectedFunctionDefinition({type:'FunctionDefinition',name:'f',params:['x','x'],body:{type:'Variable',name:'x'}},{writerId:'writer-f',taskScopeId:'task-1',specs,makeBinderId:()=> 'id',...args}),/unique/);
 assert.equal(reads,0);
});
test('S26 RED: missing allocator and colliding generated IDs fail closed',()=>{
 assert.throws(()=>compile('f(x):=x',{makeBinderId:null}),/supplier/);
 assert.throws(()=>compile('f(x;y):=x+y',{makeBinderId:()=> 'same'}),/duplicate binder/);
});
test('S26 RED: selected function IR remains immutable and serialized identically',()=>{
 const ir=compile('f(x):=x^3+4x');assert.ok(Object.isFrozen(ir.body));
 assert.ok(Object.isFrozen(ir.parameters[0]));assert.deepEqual(JSON.parse(JSON.stringify(ir)),ir);
});
