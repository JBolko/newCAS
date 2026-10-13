import test from 'node:test';
import assert from 'node:assert/strict';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {planOperationArguments} from '../../src/js/semantics/operation-argument-plan.js';

const plan=(name,n)=>planOperationArguments(findSelectedOperationSpec(name),n);
test('tangentline selected roles keep x symbolic even if x has a document value',()=>{
  const p=plan('tangentline',3);
  assert.equal(p.status,'selected');
  assert.equal(p.evaluatorId,'probe.symbolic.tangentline');
  assert.deepEqual(p.arguments.map(a=>a.role),['value','symbolic','value']);
  assert.equal(p.arguments[1].name,'variable');
  assert.ok(Object.isFrozen(p.arguments));
});
test('integrate chooses unbounded form by arity',()=>{
  assert.deepEqual(plan('integrate',2).arguments.map(a=>a.role),['value','symbolic']);
});
test('integrate chooses bounded form and keeps both bounds as values',()=>{
  assert.deepEqual(plan('integrate',4).arguments.map(a=>a.role),['value','symbolic','value','value']);
});
test('unsupported arity is reported without selecting a signature',()=>{
  const p=plan('integrate',3);
  assert.equal(p.status,'wrong-arity'); assert.deepEqual(p.expected,[2,4]);
});
test('geometry is governed by catalog roles without operation-specific logic',()=>{
  for(const name of ['arclength','surfacearea'])
    assert.deepEqual(plan(name,4).arguments.map(a=>a.role),['value','symbolic','value','value']);
});
test('scoped argument policy is preserved without allocating identities',()=>{
  const spec=operationSpec({operationId:'sample',evaluatorId:'sample',arguments:[
    {name:'body',role:'value'}, {name:'binder',role:'scoped',scopeOver:['body']} ]});
  const p=planOperationArguments(spec,2);
  assert.deepEqual(p.arguments[1].scopeOver,['body']);
});
test('variadic signature is expanded generically',()=>{
  const spec=operationSpec({operationId:'sample',evaluatorId:'sample',arguments:[
    {name:'value',role:'value',variadic:true}]});
  assert.equal(planOperationArguments(spec,3).arguments.length,3);
});
