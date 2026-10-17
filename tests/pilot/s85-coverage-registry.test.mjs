/** S85a registry integrity only. Evidence verification is separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STRESS_COVERAGE} from './s85-coverage-registry.mjs';
import {repoPath} from './lib/paths.mjs';

test('S86a register: 55 frozen cases, #14/#41 at IR+JS-leaf, no real Worker E2E claimed', () => {
  const text = readFileSync(repoPath('docs/architecture/v1.0/ARCHITECTURE_STRESS_TESTS_FROZEN_v1.0.md'), 'utf8');
  const numbers = [...text.matchAll(/^## (\d+)\./gm)].map(x => Number(x[1])).filter(x => x <= 55);
  assert.deepEqual(numbers, Array.from({length:55},(_,i)=>i+1));
  assert.deepEqual(STRESS_COVERAGE.map(r=>r.n), numbers);
  for (const row of STRESS_COVERAGE) {
    assert.ok(['e2e','binding','gap','blocked','unknown'].includes(row.status));
    assert.ok(typeof row.evidence==='string' && row.evidence.length>0);
  }
  assert.equal(STRESS_COVERAGE.filter(r=>r.status==='e2e').length, 0);
  for (const n of [14,41]) {
    const record=STRESS_COVERAGE.find(row=>row.n===n);
    assert.equal(record.status,'binding');
    assert.match(record.evidence,/selected IR \+ JS leaf/);
  }
});
