import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {planOperationArguments} from '../../src/js/semantics/operation-argument-plan.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,providerReference} from '../../src/js/semantics/semantic-ir.js';
import {list,expression} from '../../src/js/values/value.js';

const ops=['mean','variance','standard_deviation','sample_variance','sample_standard_deviation',
  'median','quartiles','min','max','five_number_summary'];

test('S100j same public statistics expose explicit raw and absolute-count signatures',()=>{
  for(const op of ops){
    const spec=findSelectedOperationSpec(op);assert.equal(spec.purity,'pure');
    assert.deepEqual(spec.signatures,[{arguments:[{name:'data',role:'value'}]},
      {arguments:[{name:'values',role:'value'},{name:'counts',role:'value'}]}]);
    assert.equal(planOperationArguments(spec,1).status,'selected');
    assert.equal(planOperationArguments(spec,2).status,'selected');
    assert.deepEqual(planOperationArguments(spec,3).expected,[1,2]);
  }
});

test('S100j generic selected-call compilation keeps both provider identities and ordered Value inputs',()=>{
  const make=values=>list(values.map(value=>expression({op:'integer',value})));
  const X=make(['2','3','5']),H=make(['2','1','3']);
  const env={protocol:'newcas.semantic-evaluation.v1',revision:'j1',blockId:'use',taskScopeId:'T',source:'mean(X,H)',
    providers:[{name:'X',providerId:'x-writer',value:X},{name:'H',providerId:'h-writer',value:H}]};
  const ir=call(operationReference('mean'),[providerReference('x-writer'),providerReference('h-writer')]);
  const selected=compileSelectedValueCall(env,ir,findSelectedOperationSpec('mean'));
  assert.deepEqual(selected.evaluationRequest.inputs,[X,H]);
  assert.deepEqual(selected.providerIds,[{name:'X',providerId:'x-writer'},{name:'H',providerId:'h-writer'}]);
  assert.deepEqual(selected.evaluationRequest.options,{});
  assert.ok(Object.isFrozen(selected.evaluationRequest.inputs));
});
