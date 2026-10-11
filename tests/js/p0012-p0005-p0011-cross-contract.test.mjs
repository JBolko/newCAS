import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expression, interval, unionSet, negativeInfinityBound,
  positiveInfinityBound, encodeValue, decodeValue,
} from '../../src/js/values/value.js';

const exact = n => expression({op:'integer', value:String(n)});
const approx = (value, precisionBits) => expression({op:'approx', value, precisionBits});

test('P0005 union of unbounded intervals survives JSON beside P0011 precisionBits', () => {
  const left = interval(negativeInfinityBound(), exact(-1), {upperClosed:true});
  const right = interval(exact(1), positiveInfinityBound(), {lowerClosed:true});
  const solution = unionSet([right, left]);
  const numerical = approx('0.500000000000000000000', 80);
  for (const v of [solution, numerical]) {
    assert.deepEqual(decodeValue(encodeValue(v)), v);
  }
  assert.equal(numerical.data.expr.precisionBits, 80);
});

test('P0011 malformed decimals remain invalid after P0005 set extension', () => {
  for (const text of ['NaN', 'Infinity', '-Infinity', '1foo', ' 0.1 ', '']) {
    assert.throws(() => encodeValue(expression({op:'approx', value:text, precisionBits:53})), text);
  }
});

test('P0005 infinity markers are not ordinary numeric approximations', () => {
  assert.throws(() => encodeValue(expression({op:'approx', value:'Infinity'})));
  assert.throws(() => interval(positiveInfinityBound(), exact(1)));
  assert.throws(() => interval(exact(1), negativeInfinityBound()));
});

test('P0011 legacy approximations remain valid after P0005 set extension', () => {
  const legacy = expression({op:'approx', value:'0.1'});
  assert.deepEqual(decodeValue(encodeValue(legacy)), legacy);
});
