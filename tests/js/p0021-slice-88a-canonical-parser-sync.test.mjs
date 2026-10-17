/** P0021 S88a. Source grammar is authoritative; parser.mjs is generated.
 * These tests intentionally run under the normal `node --test` suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import peggy from 'peggy';
import {parse} from '../../src/js/parser.mjs';

const source = readFileSync(new URL('../../docs/Grammatik.pegjs', import.meta.url), 'utf8');
const canonicalParser = peggy.generate(source);
const normalize = text => text.replace(/\r\n/g, '\n');

test('S88a: generated parser is exactly the canonical Peggy source output', () => {
  const expected = peggy.generate(source, {format:'es', output:'source'});
  const shipped = readFileSync(new URL('../../src/js/parser.mjs', import.meta.url), 'utf8');
  assert.equal(normalize(shipped), normalize(expected),
    'src/js/parser.mjs has drifted from docs/Grammatik.pegjs; run the explicit generator');
});

test('S88a: canonical decimal dot and two arguments separated by comma', () => {
  assert.deepEqual(parse('1.5'), canonicalParser.parse('1.5'));
  assert.deepEqual(parse('f(1,5)'), canonicalParser.parse('f(1,5)'));
  const call = parse('f(1,5)')[0];
  assert.equal(call.type, 'FunctionCall');
  assert.deepEqual(call.args.map(arg => arg.value), [1,5]);
});

test('S88a: decimal comma is not accepted in canonical source', () => {
  assert.throws(() => parse('x := 0,5'));
  assert.throws(() => parse('1,5'));
});

test('S88a: semicolon can separate expressions, without enabling multi-writer runtime', () => {
  const parsed = parse('a := 1; b := 3; resultat := a b');
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed.map(statement => [statement.type, statement.name]), [
    ['Assignment','a'], ['Assignment','b'], ['Assignment','resultat'],
  ]);
  assert.equal(parsed[2].value.type, 'BinaryExpression');
  assert.equal(parsed[2].value.op, '*');
  assert.deepEqual([parsed[2].value.left.name,parsed[2].value.right.name], ['a','b']);
  // The DocumentRuntime contract for multiple writers in one block is deferred.
});

test('S88a: canonical grammar still distinguishes quantities and lists', () => {
  for (const input of ['5[m]', '3.5[kg*m/s^2]', 'f(1;2)', '[1,2]','5[m]->[cm]']) {
    assert.deepEqual(parse(input), canonicalParser.parse(input), input);
  }
});
