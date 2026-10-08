import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeValue, decodeValue } from '../../src/js/values/value.js';
const wrap = (expr) => ({ valueVersion: 1, kind: 'expression', data: { expr } });

test('approx with precision retains value transport JSON', () => {
  const value = wrap({ op: 'approx', value: '4333333333333333481363069950020872056484222412109375e-52', precisionBits: 53 });
  assert.deepEqual(decodeValue(encodeValue(value)), value);
});
test('existing approx without precisionBits remains valid', () => {
  const value = wrap({ op: 'approx', value: '0.1' });
  assert.deepEqual(decodeValue(encodeValue(value)), value);
});
for (const bits of [0, -1, 1.5, NaN, Infinity, '53', true, Number.MAX_SAFE_INTEGER + 1]) {
  test(`reject invalid precisionBits ${String(bits)}`, () => {
    assert.throws(() => encodeValue(wrap({op: 'approx', value: '0.1', precisionBits: bits})));
  });
}
for (const value of ['NaN', 'Infinity', '1foo', '', ' 0.1 ']) {
  test(`reject invalid approximate numeric text ${JSON.stringify(value)}`, () => {
    assert.throws(() => encodeValue(wrap({op: 'approx', value})));
  });
}
