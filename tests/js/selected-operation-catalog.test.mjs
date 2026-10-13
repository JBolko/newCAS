import test from 'node:test';
import assert from 'node:assert/strict';
import { isOperationSpec } from '../../src/js/operations/operation-spec.js';
import {selectedOperationSpecs, findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';

const roles = (s, n = 0) => s.signatures[n].arguments.map(a => a.role);

test('catalog contains only genuine immutable P0008 OperationSpecs', () => {
  assert.equal(Object.isFrozen(selectedOperationSpecs), true);
  assert.ok(selectedOperationSpecs.every(isOperationSpec));
  assert.equal(new Set(selectedOperationSpecs.map(s=>s.operationId)).size, selectedOperationSpecs.length);
});
test('selected lookup has no fallback to arbitrary Python names', () => {
  assert.equal(findSelectedOperationSpec('not_a_function'), null);
  assert.equal(findSelectedOperationSpec('registry'), null);
});
test('public names and internal probe evaluator IDs stay distinct', () => {
  for(const name of ['integrate','tangentline','arclength','surfacearea']) {
    const spec = findSelectedOperationSpec(name);
    assert.equal(spec.operationId, name);
    assert.equal(spec.evaluatorId, `probe.symbolic.${name}`);
    assert.equal(spec.purity, 'pure');
  }
});
test('tangentline symbolic variable is declared, without parser name special cases', () => {
  assert.deepEqual(roles(findSelectedOperationSpec('tangentline')), ['value','symbolic','value']);
});
test('geometry operations share the same roles and four-argument signature', () => {
  for(const name of ['arclength','surfacearea'])
    assert.deepEqual(roles(findSelectedOperationSpec(name)),['value','symbolic','value','value']);
});
test('integration signatures preserve symbolic target and Value bounds', () => {
  const s=findSelectedOperationSpec('integrate');
  assert.equal(s.signatures.length,2);
  assert.deepEqual(roles(s,0),['value','symbolic']);
  assert.deepEqual(roles(s,1),['value','symbolic','value','value']);
});
test('unknown operation remains unknown, no Python registry mutation', () => {
  assert.equal(findSelectedOperationSpec('f'),null);
  assert.equal(findSelectedOperationSpec('surfacearea_revolution'),null);
});
