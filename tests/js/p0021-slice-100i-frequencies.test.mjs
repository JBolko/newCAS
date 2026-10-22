import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec,selectedOperationSpecs} from '../../src/js/operations/selected-operation-catalog.js';

test('S100i frequency projections retain their distinct pure unary value signature',()=>{
  for(const op of ['observation_values','absolute_frequencies','relative_frequencies',
    'cumulative_absolute_frequencies','cumulative_relative_frequencies']){
    const spec=findSelectedOperationSpec(op);assert.ok(spec,op);
    assert.equal(spec.purity,'pure');assert.equal(spec.evaluatorId,`probe.statistics.${op}`);
    assert.deepEqual(spec.signatures[0],{arguments:[{name:'data',role:'value'}]});
    assert.equal(selectedOperationSpecs.filter(s=>s.operationId===op).length,1);
  }
});
