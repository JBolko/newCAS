import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const worker=source('../../src/js/evaluation/selected-pyodide-worker.js');
const baseline=source('../../docs/architecture/P0004-version-lock-and-developer-baseline.md');
test('new selected Worker pins exactly P0004 Pyodide 314.0.7',()=>{
  assert.match(baseline,/Pyodide\s+314\.0\.7\s+Browser Python runtime/);
  assert.match(worker,/https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\/full\//);
  assert.doesNotMatch(worker,/v0\.26\.1/);
});
test('new selected Worker uses same pinned index URL for ESM loader and loadPyodide',()=>{
  assert.match(worker,/indexURL:\s*CDN/);
  assert.match(worker,/import\(`\$\{CDN\}pyodide\.mjs`\)/);
});
test('actual Pyodide version and SymPy version must be verified in a real browser, not inferred from URL',()=>{
  const probe=source('../browser/p0021-p0004-version-probe.mjs');
  assert.match(probe,/await py\.loadPackage\('sympy'\)/);
  assert.match(probe,/py\.version/);
  assert.match(probe,/sys\.version_info/);
  assert.match(probe,/sympy\.__version__/);
  assert.match(probe,/314\.0\.7/);
  assert.match(probe,/1\.14\.0/);
});
