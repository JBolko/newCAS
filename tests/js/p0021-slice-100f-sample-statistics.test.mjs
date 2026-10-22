import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';

test('S100f sample operations are explicit pure unary operations, distinct from population',()=>{
  for(const op of ['sample_variance','sample_standard_deviation']){
    const spec=findSelectedOperationSpec(op);assert.ok(spec,op);
    assert.equal(spec.purity,'pure');
    assert.equal(spec.evaluatorId,`probe.statistics.${op}`);
    assert.deepEqual(spec.signatures,[{arguments:[{name:'data',role:'value'}]}]);
    assert.notEqual(spec.evaluatorId,findSelectedOperationSpec(op.slice('sample_'.length)).evaluatorId);
  }
});
