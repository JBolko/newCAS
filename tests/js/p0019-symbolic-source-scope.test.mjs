import test from 'node:test';
import assert from 'node:assert/strict';
import { findSelectedOperationSpec } from '../../src/js/operations/selected-operation-catalog.js';
import { resolveSelectedOperationCall } from '../../src/js/semantics/resolve-selected-operation-call.js';
import { LexicalIdentityScope, sameIdentity, freeSymbolIdentity } from '../../src/js/semantics/identity.js';
import { semanticReference, valueLiteral } from '../../src/js/semantics/semantic-ir.js';

const v = name => ({type:'Variable',name});
const lit = value => ({type:'Literal',value});
const fun = (name,args) => ({type:'FunctionCall',name,args});
const expr = (op,left,right) => ({type:'BinaryExpression',op,left,right});
const identity = {makeLocalId:({index,name}) => `call-24:${index}:${name}`};
function resolveSource(node,scope) {
  if(node.type==='Variable') return semanticReference(scope.resolve(node.name));
  if(node.type==='BinaryExpression') {
    // This test uses a deliberately transparent shape via free references:
    // "x²" is represented by the reference to x for identity testing only.
    return resolveSource(node.left,scope);
  }
  if(node.type==='Materialized') return node.ir; // NEVER re-resolve
  if(node.type==='Literal') return semanticReference(freeSymbolIdentity('numbers',String(node.value)));
  throw Error('unhandled source fixture');
}
function run(ast, observations=[]) {
  const outer = new LexicalIdentityScope('task-1');
  const result = resolveSelectedOperationCall(ast,
    findSelectedOperationSpec(ast.name),
    (node,meta)=>{
      observations.push(meta);
      return resolveSource(node,meta.lexicalScope??outer);
    },
    identity.makeLocalId,outer);
  return {result,outer};
}
test('P0019 symbolic target scopes preceding source expression before lookup',()=>{
  const {result}=run(fun('tangentline',[expr('^',v('x'),lit(2)),v('x'),lit(2)]));
  const lhs=result.args[0].identity, target=result.args[1].identity;
  assert.ok(sameIdentity(lhs,target));
  assert.equal(target.kind,'operation-local');
});
test('P0019 prior writer does not capture source operand of symbolic call',()=>{
  // We simulate x := 17 by the caller's ordinary lookup policy;
  // the operation scope takes precedence for this source occurrence.
  const {result}=run(fun('tangentline',[v('x'),v('x'),lit(2)]));
  assert.equal(result.args[0].identity.kind,'operation-local');
});
test('P0019 already materialized Value identity stays unchanged',()=>{
  const existing=semanticReference(freeSymbolIdentity('task-1','x'));
  const {result}=run(fun('tangentline',[{type:'Materialized',ir:existing},v('x'),lit(2)]));
  assert.ok(sameIdentity(result.args[0].identity,existing.identity));
  assert.equal(result.args[1].identity.kind,'operation-local');
});
test('P0019 bounded integration upper x gets caller source scope, without rewriting a Value',()=>{
  const {result}=run(fun('integrate',[v('x'),v('x'),lit(1),v('x')]));
  assert.ok(sameIdentity(result.args[0].identity,result.args[1].identity));
  assert.equal(result.args[3].identity.kind,'free-symbol');
});
test('P0019 resolve callback receives immutable lexical scope',()=>{
  const received=[];run(fun('tangentline',[v('x'),v('x'),lit(2)]),received);
  assert.ok(received.every(x=>Object.isFrozen(x)));
  assert.ok(received.every(x=>x.lexicalScope instanceof LexicalIdentityScope));
});
test('P0019 calls without a scope retain slice 2 contract',()=>{
 const result=resolveSelectedOperationCall(fun('tangentline',[v('x'),v('x'),lit(2)]),
 findSelectedOperationSpec('tangentline'),
 n=>semanticReference(freeSymbolIdentity('task-1',n.name||'number')),
 identity.makeLocalId);
 assert.equal(result.args[0].identity.kind,'free-symbol');
 assert.equal(result.args[1].identity.kind,'operation-local');
});
