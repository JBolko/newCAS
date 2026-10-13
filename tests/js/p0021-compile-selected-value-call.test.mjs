import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSelectedValueCall as compile } from '../../src/js/semantics/compile-selected-value-call.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import { valueLiteral, providerReference, operationReference, call, define } from '../../src/js/semantics/semantic-ir.js';
const integer = n => Object.freeze({valueVersion:1,kind:'expression',data:Object.freeze({expr:Object.freeze({op:'integer',value:String(n)})})});
const spec = operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
const envelope = (providers=[])=>({protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b',taskScopeId:'T',source:'b := 2+3',providers});
const ir=(a,b)=>define('b',call(operationReference('add'),[a,b]));
test('selected immutable IR literals compile to P0010 request',()=>{
 const out=compile(envelope(),ir(valueLiteral(integer(2)),valueLiteral(integer(3))),spec);
 assert.equal(out.evaluationRequest.evaluatorId,'probe.scalar.add');
 assert.deepEqual(out.evaluationRequest.inputs,[integer(2),integer(3)]);
 assert.equal(out.operationSpec.operationId,'add');
 assert.ok(Object.isFrozen(out.evaluationRequest.inputs));
});
test('provider reference is resolved by exact writer id, not source name',()=>{
 const out=compile(envelope([{name:'x',providerId:'writer-2',value:integer(4)}]),ir(providerReference('writer-2'),valueLiteral(integer(3))),spec);
 assert.deepEqual(out.evaluationRequest.inputs,[integer(4),integer(3)]);
 assert.deepEqual(out.providerIds,[{name:'x',providerId:'writer-2'}]);
});
test('wrong provider identity cannot fall back to matching variable name',()=>{
 assert.throws(()=>compile(envelope([{name:'x',providerId:'writer-1',value:integer(4)}]),ir(providerReference('writer-2'),valueLiteral(integer(3))),spec),/provider identity/);
});
test('unused provider is rejected instead of silently ignored',()=>{
 assert.throws(()=>compile(envelope([{name:'x',providerId:'old',value:integer(4)}]),ir(valueLiteral(integer(2)),valueLiteral(integer(3))),spec),/unused/);
});
test('mismatched OperationSpec is rejected',()=>{
 const sub=operationSpec({operationId:'subtract',evaluatorId:'probe.scalar.subtract',arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
 assert.throws(()=>compile(envelope(),ir(valueLiteral(integer(2)),valueLiteral(integer(3))),sub),/operation identity/);
});
test('wrong arity fails before Python',()=>{
 const one=define('b',call(operationReference('add'),[valueLiteral(integer(2))]));
 assert.throws(()=>compile(envelope(),one,spec),/arity/);
});
test('symbolic argument is explicitly deferred',()=>{
 const symbolic=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
 const input=define('b',call(operationReference('diff'),[valueLiteral(integer(2)),valueLiteral(integer(3))]));
 assert.throws(()=>compile(envelope(),input,symbolic),/symbolic/);
});
test('nested expression is explicitly deferred',()=>{
 const nested=define('b',call(operationReference('add'),[call(operationReference('add'),[valueLiteral(integer(1)),valueLiteral(integer(2))]),valueLiteral(integer(3))]));
 assert.throws(()=>compile(envelope(),nested,spec),/unsupported argument/);
});
test('writer must match block identity',()=>{
 assert.throws(()=>compile(envelope(),define('other',call(operationReference('add'),[valueLiteral(integer(2)),valueLiteral(integer(3))])),spec),/writer/);
});
test('multiple bindings with the same name are rejected',()=>{
 const e=envelope([{name:'x',providerId:'w1',value:integer(1)},{name:'x',providerId:'w2',value:integer(2)}]);
 assert.throws(()=>compile(e,ir(providerReference('w1'),valueLiteral(integer(3))),spec),/provider bindings/);
});
