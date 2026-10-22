import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {planOperationArguments} from '../../src/js/semantics/operation-argument-plan.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,providerReference} from '../../src/js/semantics/semantic-ir.js';
import {list,expression} from '../../src/js/values/value.js';
import {frequencyOperations} from '../helpers/s100i-frequency-cases.mjs';

test('S100k all five projections preserve identities and declare both complete value signatures',()=>{
  for(const op of frequencyOperations){
    const spec=findSelectedOperationSpec(op);assert.equal(spec.purity,'pure');
    assert.equal(spec.evaluatorId,`probe.statistics.${op}`);
    assert.deepEqual(spec.signatures,[{arguments:[{name:'data',role:'value'}]},
      {arguments:[{name:'values',role:'value'},{name:'counts',role:'value'}]}]);
    assert.equal(planOperationArguments(spec,1).status,'selected');
    assert.equal(planOperationArguments(spec,2).status,'selected');
    assert.deepEqual(planOperationArguments(spec,3).expected,[1,2]);
  }
});

test('S100k generic compiler preserves ordered X/H inputs and their provider attestations',()=>{
  const make=values=>list(values.map(value=>expression({op:'integer',value})));
  const X=make(['5','2','3','2']),H=make(['3','1','0','1']);
  for(const op of frequencyOperations){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:'k1',blockId:'use',taskScopeId:'T',source:`${op}(X,H)`,
      providers:[{name:'X',providerId:'x-provider',value:X},{name:'H',providerId:'h-provider',value:H}]};
    const selected=compileSelectedValueCall(env,call(operationReference(op),[providerReference('x-provider'),providerReference('h-provider')]),findSelectedOperationSpec(op));
    assert.deepEqual(selected.evaluationRequest.inputs,[X,H]);
    assert.deepEqual(selected.providerIds,[{name:'X',providerId:'x-provider'},{name:'H',providerId:'h-provider'}]);
    assert.deepEqual(selected.evaluationRequest.options,{});
  }
});
