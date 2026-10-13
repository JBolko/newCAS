import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {materializeSelectedFunctionValue} from '../../src/js/semantics/materialize-selected-function-value.js';
import {applySelectedFunctionValue} from '../../src/js/semantics/apply-selected-function-value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {binderIdentity,freeSymbolIdentity,sameIdentity} from '../../src/js/semantics/identity.js';
import {expression,functionValue,encodeValue,decodeValue} from '../../src/js/values/value.js';

const spec=n=>operationSpec({operationId:n,evaluatorId:`probe.scalar.${n}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]});
const specs=new Map(['add','multiply','power'].map(n=>[n,spec(n)]));
const integer=n=>expression({op:'integer',value:String(n)});
const make=(source,captures=[])=>materializeSelectedFunctionValue(compileSelectedFunctionDefinition(parse(source),{
 writerId:'writer-f',taskScopeId:'task',specs,makeBinderId:({writerId,index})=>`${writerId}:${index}`,
 resolveVariable:()=>providerReference('writer-y'),
}),{captures});
const evalInteger=node=>{
 switch(node.op){
 case 'integer':return BigInt(node.value);
 case 'add':return node.args.reduce((s,a)=>s+evalInteger(a),0n);
 case 'mul':return node.args.reduce((s,a)=>s*evalInteger(a),1n);
 case 'pow':return evalInteger(node.base)**evalInteger(node.exponent);
 default:throw Error('unexpected non-integer expression');
 }
};

test('S28: f(t)=t^3+4t applied to document-provided 12 yields exact value expression',()=>{
 const fn=make('f(t):=t^3+4t');
 const result=applySelectedFunctionValue(fn,[integer(12)]);
 assert.equal(evalInteger(result.data.expr),1776n);
 assert.equal(result.kind,'expression');
 assert.deepEqual(decodeValue(encodeValue(result)),result);
 assert.equal(fn.data.parameters[0].identity.displayName,'t');
});
test('S28: argument x belongs to document, not function binder',()=>{
 const fn=make('f(x):=x^3+4x');
 const documentX=freeSymbolIdentity('task','x');
 const result=applySelectedFunctionValue(fn,[expression({op:'symbolRef',identity:documentX})]);
 const [power,product]=result.data.expr.args;
 assert.ok(sameIdentity(power.base.identity,documentX));
 assert.ok(sameIdentity(product.args[1].identity,documentX));
 assert.ok(!sameIdentity(documentX,fn.data.parameters[0].identity));
});
test('S28: explicit capture uses Value rather than name lookup',()=>{
 const captured=freeSymbolIdentity('task','y');
 const fn=make('f(x):=x+y',[{providerId:'writer-y',identity:captured,value:integer(7)}]);
 const result=applySelectedFunctionValue(fn,[integer(3)]);
 assert.equal(evalInteger(result.data.expr),10n);
 assert.equal(fn.data.capturedValues[0].value.data.expr.value,'7');
});
test('S28: no implicit provider/name fallback and wrong arity fails closed',()=>{
 const fn=make('f(x):=x^3+4x');
 assert.throws(()=>applySelectedFunctionValue(fn,[]),/arity/);
 assert.throws(()=>applySelectedFunctionValue(fn,[integer(1),integer(2)]),/arity/);
 assert.throws(()=>applySelectedFunctionValue(fn,[12]),/expression Value/);
 assert.throws(()=>applySelectedFunctionValue(integer(5),[integer(1)]),/FunctionValue/);
});
test('S28: unrelated free symbol in body cannot use matching display name as binder',()=>{
 const binder=binderIdentity('binder-1','x');
 const free=freeSymbolIdentity('task','x');
 const fn=functionValue([{identity:binder}],expression({op:'add',args:[{op:'symbolRef',identity:binder},{op:'symbolRef',identity:free}]}));
 assert.throws(()=>applySelectedFunctionValue(fn,[integer(12)]),/unbound symbol identity/);
});
test('S28: exact identity substitution across two independent binders',()=>{
 const a=binderIdentity('a','x'),b=binderIdentity('b','x');
 const fn=functionValue([{identity:a},{identity:b}],expression({op:'add',args:[{op:'symbolRef',identity:a},{op:'symbolRef',identity:b}]}));
 assert.equal(evalInteger(applySelectedFunctionValue(fn,[integer(2),integer(5)]).data.expr),7n);
});
