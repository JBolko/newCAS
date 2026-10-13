import test from 'node:test';
import assert from 'node:assert/strict';
import { establishSourceWriters } from '../../src/js/semantics/establish-source-writers.js';
import { resolvePositionalName } from '../../src/js/semantics/resolve-positional-name.js';

const ctx={writerId:'block-1',taskScopeId:'task-A',position:2};
const lit={type:'Literal',value:17};
const assign=(name='x',value=lit)=>({type:'Assignment',name,value});
const func=(name='f',params=['x'],body=lit)=>({type:'FunctionDefinition',name,params,body});
const descriptors=(ast,config=ctx)=>establishSourceWriters(ast,config);

test('P0020 valid assignment establishes writer before RHS mathematical evaluation',()=>{
 const writers=descriptors([assign('x',{type:'BinaryExpression',op:'/',left:lit,right:{type:'Literal',value:0}})]);
 assert.equal(writers.length,1); assert.equal(writers[0].established,true);
 assert.equal(resolvePositionalName({name:'x',position:3,taskScopeId:'task-A',writers}).providerId,'block-1');
});
test('P0020 function definition establishes writer with valid unique parameters',()=>{
 assert.equal(descriptors([func()])[0].name,'f');
});
test('P0020 structurally invalid duplicate parameters establish no writer',()=>{
 assert.deepEqual(descriptors([func('f',['x','x'])]),[]);
});
test('P0020 invalid function parameter establishes no writer',()=>{
 assert.deepEqual(descriptors([func('f',['2x'])]),[]);
});
test('P0020 expression, relation, and function call are not writers',()=>{
 for (const ast of [{type:'Variable',name:'x'},{type:'Equation',operator:'=',left:lit,right:lit},{type:'FunctionCall',name:'sin',args:[lit]}]) {
   assert.deepEqual(descriptors([ast]),[]);
 }
});
test('P0020 malformed assignment target and missing RHS establish no writer',()=>{
 assert.deepEqual(descriptors([assign('2x')]),[]);
 assert.deepEqual(descriptors([assign('x',null)]),[]);
});
test('P0020 empty and multi-statement AST are not silently assigned a single writer position',()=>{
 assert.deepEqual(descriptors([]),[]);
 assert.deepEqual(descriptors([assign('x'),assign('y')]),[]);
});
test('P0020 writer descriptor is immutable and detached from AST',()=>{
 const source=[assign()];
 const [writer]=descriptors(source);
 assert.ok(Object.isFrozen(writer));
 assert.ok(Object.isFrozen(descriptors(source)));
 source[0].name='changed';
 assert.equal(writer.name,'x');
});
test('P0020 selected writer is nearest and a later failed value does not fallback',()=>{
 const prior=descriptors([assign('x')],{writerId:'old',taskScopeId:'task-A',position:1});
 const broken=descriptors([assign('x',{type:'Variable',name:'unknown'})],{writerId:'new',taskScopeId:'task-A',position:3});
 const selected=resolvePositionalName({name:'x',position:4,taskScopeId:'task-A',writers:[...prior,...broken.map(w=>({...w,available:false}))]});
 assert.equal(selected.providerId,'new');
});
test('P0020 writer does not escape its task',()=>{
 const writers=descriptors([assign()]);
 assert.equal(resolvePositionalName({name:'x',position:3,taskScopeId:'task-B',writers}).kind,'semantic-reference');
});
