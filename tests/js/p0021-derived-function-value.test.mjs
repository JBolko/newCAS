import test from 'node:test';
import assert from 'node:assert/strict';
import {binderIdentity,freeSymbolIdentity} from '../../src/js/semantics/identity.js';
import {expression,functionValue,encodeValue,decodeValue} from '../../src/js/values/value.js';
import {applySelectedFunctionValue} from '../../src/js/semantics/apply-selected-function-value.js';
import {materializeSelectedDerivativeFunction as derive} from '../../src/js/semantics/materialize-selected-derivative-function.js';

const x=binderIdentity('writer-f:parameter-0','x');
const y=binderIdentity('writer-g:parameter-0','x');
const n=v=>({op:'integer',value:String(v)});
const ref=id=>({op:'symbolRef',identity:id});
const add=(...args)=>({op:'add',args});
const mul=(...args)=>({op:'mul',args});
const pow=(base,exponent)=>({op:'pow',base,exponent});
const e=expr=>expression(expr);
const f=()=>functionValue([{identity:x}],e(add(pow(ref(x),n(3)),mul(n(4),ref(x)))),[]);
const derivative=()=>e(add(mul(n(3),pow(ref(x),n(2))),n(4)));
const evaluate=node=>{switch(node.op){case 'integer':return BigInt(node.value);case 'add':return node.args.reduce((a,b)=>a+evaluate(b),0n);case 'mul':return node.args.reduce((a,b)=>a*evaluate(b),1n);case 'pow':return evaluate(node.base)**evaluate(node.exponent);default:throw Error('unexpected symbolic expression');}};

test('S36: derivative Value becomes FunctionValue with original lexical binder',()=>{
 const result=derive({fn:f(),derivative:derivative(),targetIdentity:x});
 assert.equal(result.kind,'function');
 assert.deepEqual(result.data.parameters,[{identity:x}]);
 assert.deepEqual(result.data.body,derivative());
 assert.deepEqual(result.data.capturedValues,[]);
 assert.equal(Object.isFrozen(result),true);
});
test('S36: applying derivative function at 0, 1, and 12 yields 4, 7, 436',()=>{
 const result=derive({fn:f(),derivative:derivative(),targetIdentity:x});
 for(const [arg,expected] of [[0,4n],[1,7n],[12,436n]])
   assert.equal(evaluate(applySelectedFunctionValue(result,[e(n(arg))]).data.expr),expected);
});
test('S36: original function remains unchanged and derivative Value roundtrips',()=>{
 const original=f();const before=encodeValue(original);
 const result=derive({fn:original,derivative:derivative(),targetIdentity:x});
 assert.equal(encodeValue(original),before);
 assert.deepEqual(decodeValue(encodeValue(result)),result);
});
test('S36: same display name but different binder identity is rejected',()=>{
 assert.throws(()=>derive({fn:f(),derivative:derivative(),targetIdentity:y}),/target identity/);
 assert.throws(()=>derive({fn:f(),derivative:e(add(ref(y),n(4))),targetIdentity:x}),/foreign derivative symbol/);
});
test('S36: free symbol with same name is not accepted in result',()=>{
 assert.throws(()=>derive({fn:f(),derivative:e(ref(freeSymbolIdentity('task','x'))),targetIdentity:x}),/foreign derivative symbol/);
});
test('S36: zero derivative remains a valid closed function',()=>{
 const result=derive({fn:f(),derivative:e(n(0)),targetIdentity:x});
 assert.equal(evaluate(applySelectedFunctionValue(result,[e(n(12))]).data.expr),0n);
});
test('S36: missing selection and unsupported derivative shape fail closed',()=>{
 assert.throws(()=>derive({fn:f(),derivative:derivative()}),/target identity/);
 assert.throws(()=>derive({fn:e(n(3)),derivative:derivative(),targetIdentity:x}),/FunctionValue/);
 assert.throws(()=>derive({fn:f(),derivative:e({op:'call',name:'sin',args:[ref(x)]}),targetIdentity:x}),/unsupported derivative expression/);
});
test('S36: multi-parameter derivative not introduced implicitly',()=>{
 const source=functionValue([{identity:x},{identity:y}],e(add(ref(x),ref(y))),[]);
 assert.throws(()=>derive({fn:source,derivative:derivative(),targetIdentity:x}),/one-parameter/);
});
