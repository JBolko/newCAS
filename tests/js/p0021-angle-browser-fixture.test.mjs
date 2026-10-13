import test from 'node:test';
import assert from 'node:assert/strict';
import {smokeIntegerValue} from '../browser/p0021-smoke-value-fixtures.mjs';
import {valueLiteral} from '../../src/js/semantics/semantic-ir.js';

test('Slice 16 browser fixture constructs an immutable Value accepted by Semantic IR', () => {
  const value = smokeIntegerValue(23);
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.data));
  assert.ok(Object.isFrozen(value.data.expr));
  const literal = valueLiteral(value);
  assert.equal(literal.kind, 'value');
  assert.equal(literal.value.data.expr.value, '23');
});
test('Slice 16 browser fixture rejects unsafe values', () => {
  assert.throws(() => smokeIntegerValue(1.5), /safe integer/);
  assert.throws(() => smokeIntegerValue(Number.MAX_SAFE_INTEGER + 1), /safe integer/);
});
