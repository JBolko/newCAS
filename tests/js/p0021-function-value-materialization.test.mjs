import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {providerReference, call, operationReference, defineFunction} from '../../src/js/semantics/semantic-ir.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {freeSymbolIdentity, sameIdentity} from '../../src/js/semantics/identity.js';
import {expression, encodeValue, decodeValue} from '../../src/js/values/value.js';
const spec=(name)=>operationSpec({operationId:name,evaluatorId:`probe.scalar.${name}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]});
const specs=new Map(['add','multiply','power'].map(n=>[n,spec(n)]));
const compile=(source, resolveVariable=()=>providerReference('writer-y'))=>compileSelectedFunctionDefinition(parse(source),{writerId:'writer-f',taskScopeId:'task',specs,resolveVariable,makeBinderId:({writerId,index})=>`${writerId}:${index}`});
const int=n=>expression({op:'integer',value:String(n)});
const capture={providerId:'writer-y',identity:freeSymbolIdentity('task','y'),value:int(7)};
test('S27: function parameter survives materialization and is not x:=12',()=>{
 const v=materializeSelectedFunctionValue(compile('f(x):=x^3+4x'));
 assert.equal(v.kind,'function');assert.equal(v.data.capturedValues.length,0);
 const x=v.data.parameters[0].identity;
 const body=v.data.body.data.expr;
 assert.equal(body.op,'add');
 assert.ok(sameIdentity(body.args[0].base.identity,x));
 assert.ok(sameIdentity(body.args[1].args[1].identity,x));
 assert.deepEqual(decodeValue(encodeValue(v)),v);
});
test('S27: capture is explicit, identity-preserving and immutable',()=>{
 const v=materializeSelectedFunctionValue(compile('f(x):=x+y'),{captures:[capture]});
 assert.equal(v.data.capturedValues.length,1);
 assert.ok(sameIdentity(v.data.body.data.expr.args[1].identity,capture.identity));
 assert.ok(Object.isFrozen(v.data.capturedValues[0]));
 assert.deepEqual(decodeValue(encodeValue(v)),v);
});
test('S27: no implicit fallback for missing or unused providers',()=>{
 const ir=compile('f(x):=x+y');
 assert.throws(()=>materializeSelectedFunctionValue(ir),/missing capture/);
 assert.throws(()=>materializeSelectedFunctionValue(compile('f(x):=x'),{captures:[capture]}),/unused capture/);
});
test('S27: duplicate and parameter-colliding capture identities are rejected',()=>{
 const ir=compile('f(x):=x+y');
 assert.throws(()=>materializeSelectedFunctionValue(ir,{captures:[capture,capture]}),/duplicate/);
 assert.throws(()=>materializeSelectedFunctionValue(ir,{captures:[{...capture,identity:ir.parameters[0]}]}),/colliding/);
});
test('S27: unknown function operations fail closed',()=>{
 const ir=compile('f(x):=x^2');
 const bad=defineFunction(ir.writerId, ir.parameters, call(operationReference('unknown'),ir.body.args));
 assert.throws(()=>materializeSelectedFunctionValue(bad),/unsupported selected function operation/);
});
test('S27: captures require an actual Value and semantic identity',()=>{
 assert.throws(()=>materializeSelectedFunctionValue(compile('f(x):=x+y'),{captures:[{...capture,value:12}]}),/explicit/);
});
