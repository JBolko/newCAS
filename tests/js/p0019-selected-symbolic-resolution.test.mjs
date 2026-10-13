import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {resolveSelectedOperationCall} from '../../src/js/semantics/resolve-selected-operation-call.js';
import {semanticReference, isSemanticIRNode} from '../../src/js/semantics/semantic-ir.js';
import {freeSymbolIdentity} from '../../src/js/semantics/identity.js';

const variable = name => ({type:'Variable',name});
const literal = value => ({type:'Literal',value});
const app = (name,args) => ({type:'FunctionCall',name,args});
function resolve(ast, name='tangentline') {
  const seen=[];
  const value = (node, metadata) => {
    seen.push({node,metadata});
    return semanticReference(freeSymbolIdentity('task-1', node.name ?? `num-${node.value}`));
  };
  const local = ({index,name}) => `call-1:${index}:${name}`;
  const result=resolveSelectedOperationCall(ast,findSelectedOperationSpec(name),value,local);
  return {result,seen};
}
test('P0019 symbolic target is never looked up as a prior document value',()=>{
  const {result,seen}=resolve(app('tangentline',[variable('x'),variable('x'),literal(2)]));
  assert.equal(result.kind,'call');
  assert.equal(result.callee.kind,'operation-reference');
  assert.equal(result.callee.operationId,'tangentline');
  assert.equal(seen.length,2);
  assert.deepEqual(seen.map(x=>x.metadata.role),['value','value']);
  assert.equal(result.args[0].identity.kind,'free-symbol');
  assert.equal(result.args[1].identity.kind,'operation-local');
  assert.equal(result.args[1].identity.displayName,'x');
  assert.equal(result.args[1].identity.id,'call-1:1:x');
});
test('P0019 integration bounds are values, not binder targets',()=>{
 const {result,seen}=resolve(app('integrate',[variable('f'),variable('x'),literal(1),variable('x')]),'integrate');
 assert.equal(result.args[1].identity.kind,'operation-local');
 assert.equal(result.args[3].identity.kind,'free-symbol');
 assert.deepEqual(seen.map(x=>x.metadata.name),['integrand','lower','upper']);
});
test('P0019 wrong arity does not invoke resolution',()=>{
 const {result,seen}=resolve(app('integrate',[variable('x'),variable('x'),literal(0)]),'integrate');
 assert.equal(result.status,'wrong-arity'); assert.equal(seen.length,0);
});
test('P0019 symbolic expression rather than variable is rejected at boundary',()=>{
 assert.throws(()=>resolve(app('tangentline',[variable('x'),literal(3),literal(2)])), /symbolic argument/);
});
test('P0019 source name must match selected catalog entry',()=>{
 assert.throws(()=>resolve(app('sin',[variable('x')])) ,/does not match/);
});
test('P0019 resolver must return valid Semantic IR',()=>{
 const ast=app('tangentline',[literal(1),variable('x'),literal(2)]);
 assert.throws(()=>resolveSelectedOperationCall(ast,findSelectedOperationSpec('tangentline'),()=>42,()=> 'x'),/Semantic IR/);
});
test('P0019 output structure is immutable',()=>{
 const {result}=resolve(app('tangentline',[variable('x'),variable('x'),literal(2)]));
 assert.ok(isSemanticIRNode(result));
 assert.ok(Object.isFrozen(result.args));
 assert.ok(Object.isFrozen(result.args[1].identity));
});
