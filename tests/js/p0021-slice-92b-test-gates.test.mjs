/** S92b: an unrun suite must not report success, and passing probes must be
 * normal regressions rather than forever hidden as TODO/knownGap.
 * This file tests the test harness; it does not alter runtime semantics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('S92b: npm test runs both complete JS and Python suites', () => {
  const pkg = JSON.parse(read('../../package.json'));
  assert.equal(pkg.scripts.test, 'npm run test:js && npm run test:python');
  assert.equal(pkg.scripts['test:js'], 'node --test');
  assert.equal(pkg.scripts['test:python'], 'python -m unittest discover -s tests/python -p test_*.py');
});

test('S92b: hostile-source differential fuzz is mandatory, not TODO', () => {
  const source = read('../pilot/03-differential-fuzz.test.mjs');
  assert.match(source, /test\('\[F1\/F2\] fuzz med realistiske/);
  assert.doesNotMatch(source, /knownGap\(['"]F1\/F2['"]/);
  assert.match(source, /hostile:\s*true/);
});

test('S92b: canonical parser equivalence is mandatory; open gaps remain visible', () => {
  const source = read('../pilot/04-language-and-parser-sync.test.mjs');
  assert.match(source, /test\('\[F3\] src\/js\/parser\.mjs giver samme AST/);
  assert.doesNotMatch(source, /knownGap\(['"]F3['"]/);
  assert.match(source, /cache:\s*true/);
  assert.match(source, /knownGap\('F4'/);
  assert.match(source, /knownGap\('F8'/);
});
