import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSelectedFunctionDerivative} from '../../src/js/semantics/compile-selected-function-derivative.js';
import {binderIdentity,freeSymbolIdentity} from '../../src/js/semantics/identity.js';
import {expression,functionValue} from '../../src/js/values/value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';

const x=binderIdentity('f:x','x');
const e=expr=>expression(expr);
const n=v=>({op:'integer',value:String(v)});
const ref=identity=>({op:'symbolRef',identity});
const add=(a,b)=>({op:'add',args:[a,b]});
const mul=(a,b)=>({op:'mul',args:[a,b]});
const pow=(a,b)=>({op:'pow',base:a,exponent:b});
const fn=(body,captures=[],params=[{identity:x}])=>functionValue(params,e(body),captures);
const cubic=()=>fn(add(pow(ref(x),n(3)),mul(n(4),ref(x))));
const env=()=>({protocol:'newcas.semantic-evaluation.v1',revision:'r34',blockId:'g',taskScopeId:'task',source:'derivative of f',providers:[]});
const spec=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
const compile=(f=cubic(),overrides={})=>compileSelectedFunctionDerivative({fn:f,envelope:env(),spec,...overrides});

test('derivative compiles f(t)=t^3+4t using original lexical binder',()=>{
 const result=compile();
 const [body,target]=result.evaluationRequest.inputs.map(v=>v.data.expr);
 assert.deepEqual(target,ref(x));
 assert.deepEqual(body,add(pow(ref(x),n(3)),mul(n(4),ref(x))));
 assert.equal(result.evaluationRequest.evaluatorId,'probe.symbolic.diff');
 assert.equal(result.providerIds.length,0);
});
test('caller document x=12 cannot capture the function binder',()=>{
 const result=compile();
 assert.notEqual(result.evaluationRequest.inputs[1].data.expr.identity.kind,'operation-local');
 assert.equal(result.evaluationRequest.inputs[1].data.expr.identity.id,'f:x');
});
test('captures are substituted by exact identity before differentiation',()=>{
 const y=freeSymbolIdentity('task','y');
 const f=fn(add(ref(x),ref(y)),[{identity:y,value:e(n(7))}]);
 assert.deepEqual(compile(f).evaluationRequest.inputs[0].data.expr,add(ref(x),n(7)));
});
test('unbound body reference is rejected without Python fallback',()=>{
 const y=freeSymbolIdentity('task','y');
 assert.throws(()=>compile(fn(add(ref(x),ref(y)))),/unbound symbol identity/);
});
test('multivariable function is deferred explicitly to a later partial-derivative slice',()=>{
 const t=binderIdentity('f:t','t');
 assert.throws(()=>compile(fn(ref(x),[],[{identity:x},{identity:t}])),/one-parameter derivative only/);
});
test('mismatched or unselected differentiation OperationSpec fails closed',()=>{
 const bad=operationSpec({operationId:'sin',evaluatorId:'probe.scalar.sin',arguments:[{name:'value',role:'value'}]});
 assert.throws(()=>compile(cubic(),{spec:bad}),/selected operation mismatch/);
});
test('provider supplied outside immutable FunctionValue is forbidden',()=>{
 assert.throws(()=>compile(cubic(),{envelope:{...env(),providers:[{name:'x',providerId:'p',value:e(n(12))}]}}),/no source providers/);
});
test('result is immutable P0010 request with no document state',()=>{
 const result=compile();
 assert.ok(Object.isFrozen(result));
 assert.ok(Object.isFrozen(result.evaluationRequest));
 assert.deepEqual(Object.keys(result.evaluationRequest).sort(),['evaluationRequestVersion','evaluatorId','inputs','instruction','options']);
});
