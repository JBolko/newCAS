import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
test('S94e browser explicitly runs real Web Worker and DocumentRuntime with supervised session',()=>{
  const script=source('tests/browser/p0021-slice-94e-document-recovery.mjs');
  assert.match(script,/new Worker\(/);
  assert.match(script,/createSupervisedSemanticTaskSession\(/);
  assert.match(script,/createRuntimeFunctionBatchEvaluator\(/);
  assert.match(script,/session\.restart\(\)/);
  assert.match(script,/session\.run\(\)/);
  assert.match(source('tests/browser/p0021-slice-94e-document-recovery.html'),/p0021-slice-94e-document-recovery\.mjs/);
});
test('S94e browser fixture has no Pyodide, no legacy or source-math evaluation',()=>{
  const fixture=source('tests/browser/p0021-slice-94e-math-fixture-worker.mjs');
  assert.match(fixture,/operationSpec/);
  assert.doesNotMatch(fixture,/\b(?:import|from)\s*[({\s]*[\'"]?[^\n]*?(?:selected-pyodide|cas-engine)|\bparse\(/i);
});
