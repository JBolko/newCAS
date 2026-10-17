/** P0021 S88a — former F3 TODOs, promoted to ordinary GREEN tests.
 * Canonical grammar uses '.' decimals; ',' separates arguments.
 * Localization belongs in a future explicit editing/input adapter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';

test('F3 GREEN: committed parser rejects decimal comma in canonical source', () => {
  assert.throws(() => parse('x := 0,5'));
});

test('F3 GREEN: committed parser reads f(1,5) as two canonical arguments', () => {
  const ast = parse('f(1,5)');
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'FunctionCall');
  assert.deepEqual(ast[0].args.map(arg => arg.value), [1,5]);
});
