import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec,selectedOperationSpecs} from '../../src/js/operations/selected-operation-catalog.js';

test('S100h quartiles and five-number summary retain their pure unary selected signature',()=>{
  for(const op of ['quartiles','five_number_summary']){
    const spec=findSelectedOperationSpec(op);assert.ok(spec,op);
    assert.equal(spec.purity,'pure');
    assert.equal(spec.evaluatorId,`probe.statistics.${op}`);
    assert.deepEqual(spec.signatures[0],{arguments:[{name:'data',role:'value'}]});
    assert.equal(selectedOperationSpecs.filter(s=>s.operationId===op).length,1);
  }
});
