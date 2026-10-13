import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSelectedSourceAst } from '../../src/js/semantics/compile-selected-source-ast.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import { providerReference, semanticReference, valueLiteral } from '../../src/js/semantics/semantic-ir.js';
import { freeSymbolIdentity, operationLocalIdentity } from '../../src/js/semantics/identity.js';
import { expression } from '../../src/js/values/value.js';
const spec=(id,n)=>operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:Array.from({length:n},(_,i)=>({name:`arg${i}`,role:'value'}))});
const specs=new Map([['add',2],['multiply',2],['power',2]].map(([n,a])=>[n,spec(n,a)]));
const variable=name=>({type:'Variable',name});
const lit=value=>({type:'Literal',value});
const bin=(op,left,right)=>({type:'BinaryExpression',op,left,right});
const power=(base,exponent)=>({type:'PowerExpression',base,exponent});
const compile=(ast,resolveVariable)=>compileSelectedSourceAst([ast],{specs,resolveVariable});
test('P0021 S21: free x is a free-symbol SemanticIdentity in task A',()=>{
 const ir=compile(variable('x'),name=>semanticReference(freeSymbolIdentity('task-A',name)));
 assert.equal(ir.kind,'semantic-reference'); assert.deepEqual(ir.identity,{identityVersion:1,kind:'free-symbol',taskScopeId:'task-A',name:'x'});
});
test('P0021 S21: document x is an exact provider reference, not name lookup',()=>{
 const ir=compile(variable('x'),()=>providerReference('writer-17'));
 assert.equal(ir.kind,'provider-reference');assert.equal(ir.providerId,'writer-17');
});
test('P0021 S21: same spelling can bind to two different writers',()=>{
 const first=compile(variable('x'),()=>providerReference('writer-1'));
 const later=compile(variable('x'),()=>providerReference('writer-2'));
 assert.notDeepEqual(first,later);
});
test('P0021 S21: literal and free symbol compose without Python evaluation',()=>{
 const ir=compile(bin('+',power(variable('x'),lit(2)),lit(3)),name=>semanticReference(freeSymbolIdentity('task-A',name)));
 assert.equal(ir.kind,'call');assert.equal(ir.callee.operationId,'add');
 assert.equal(ir.args[0].args[0].kind,'semantic-reference');
});
test('P0021 S21: document provider inside a power remains exact',()=>{
 const ir=compile(power(variable('x'),lit(2)),()=>providerReference('writer-old'));
 assert.equal(ir.args[0].providerId,'writer-old');
});
test('P0021 S21: no implicit symbol lookup',()=>assert.throws(()=>compile(variable('x')),/requires document-owned binding/));
test('P0021 S21: rejected unresolved variable must not silently become free',()=>assert.throws(()=>compile(variable('x'),()=>null),/requires provider-reference or semantic-reference/));
test('P0021 S21: Value is not a valid binding result (must bind provider)',()=>assert.throws(()=>compile(variable('x'),()=>valueLiteral(expression({op:'integer',value:'17'}))),/requires provider-reference or semantic-reference/));
test('P0021 S21: source resolver cannot insert arbitrary operation calls',()=>assert.throws(()=>compile(variable('x'),()=>compile(lit(2))),/requires provider-reference or semantic-reference/));
test('P0021 S21: invalid variable name rejected before resolver',()=>{let count=0; assert.throws(()=>compile(variable('2x'),()=>{count++;return providerReference('a')}),/invalid variable name/);assert.equal(count,0)});
test('P0021 S21: distinct task scopes preserve distinct free identity',()=>{
 const a=compile(variable('x'),()=>semanticReference(freeSymbolIdentity('task-A','x')));
 const b=compile(variable('x'),()=>semanticReference(freeSymbolIdentity('task-B','x')));
 assert.notDeepEqual(a,b);
});
test('P0021 S21: a symbolic operation-local identity is preserved unchanged',()=>{
 const id=operationLocalIdentity('diff-target-1','x');
 const ir=compile(variable('x'),()=>semanticReference(id));
 assert.deepEqual(ir.identity,id);
});
