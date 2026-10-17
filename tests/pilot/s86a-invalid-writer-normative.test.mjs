/** Slice 86a: frozen architecture stress #14 and #41, full selected IR path.
 * No CASEngine, no legacy Transformer, no Python code strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRuntime, evaluateAll, view, bindingFacts} from './lib/fixtures.mjs';

for (const [number, badSource] of [[14, 'a :='], [41, 'a := )(']]) {
  test(`frozen #${number}: invalid writer absent; preceding a used for b := a+1`, async () => {
    const rt=makeRuntime([['first','a := 4'],['invalid',badSource],['use','b := a+1']]);
    assert.equal(bindingFacts(rt).facts.use.refs.a,'first');
    await evaluateAll(rt);
    const results=view(rt);
    assert.match(results.first,/^success:/);
    assert.equal(results.invalid,'error:INVALID_SOURCE');
    assert.match(results.use,/^success:/);
    assert.equal(rt.getBlock('use').calculation.result.data.expr.value,'5');
  });
}
