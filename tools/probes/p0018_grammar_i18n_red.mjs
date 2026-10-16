/** P0018 opt-in RED probe. Do not include in normal node --test baseline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import peggy from 'peggy';

const source = readFileSync('docs/Grammatik.pegjs', 'utf8');
const parser = peggy.generate(source);
const parseExpression = (text) => parser.parse(text)[0];

test('existing canonical decimal point remains one numeric literal', () => {
  assert.deepEqual(parseExpression('1.5'), {type:'Literal',value:1.5});
});

test('semicolon distinguishes two arguments independent of decimal locale', () => {
  const call = parseExpression('f(1;5)');
  assert.equal(call.type, 'FunctionCall');
  assert.equal(call.args.length, 2);
  assert.deepEqual(call.args.map(a => a.value), [1,5]);
});

test('RED: canonical comma separator must not silently collapse two arguments', () => {
  const call = parseExpression('f(1,5)');
  assert.equal(call.type, 'FunctionCall');
  assert.equal(call.args.length, 2,
    'Currently parsed as one decimal-comma argument; locale-sensitive normalization/policy needed');
  assert.deepEqual(call.args.map(a=>a.value),[1,5]);
});
