import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../browser/p0021-slice-83-active-ir-worker.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../browser/p0021-slice-83-active-ir-worker.mjs',import.meta.url),'utf8');
test('browser accepts only actual selected Pyodide Worker transport',()=>{
  assert.match(source,/new Worker\(new URL\('\.\.\/\.\.\/src\/js\/evaluation\/selected-pyodide-worker\.js'/);
  assert.match(source,/createWorkerEvaluationClient\(/);
  assert.match(source,/client\.evaluate\(envelope,selection\)/);
  assert.doesNotMatch(source,/const evaluate\s*=\s*async\s*\([^)]*\)\s*=>\s*\{\s*const \[a,b\]/);
});
test('actual DocumentRuntime uses active IR batch and distinct task scopes',()=>{
  assert.match(source,/new DocumentRuntime\(/);
  assert.match(source,/createRuntimeFunctionBatchEvaluator\(/);
  assert.match(source,/populate\(rt,'A',2\)/);
  assert.match(source,/populate\(rt,'B',10\)/);
  assert.match(source,/rt\.setBlockSource\('A-a','a:=5'\)/);
  assert.doesNotMatch(source,/createBoundFunctionTaskEvaluator|createSourceComposedExpressionTaskEvaluator/);
});
test('browser page exposes run action and result reporting',()=>{
  assert.match(page,/id="run"/);
  assert.match(page,/p0021-slice-83-active-ir-worker\.mjs/);
  assert.match(source,/status\.textContent='PASS/);
  assert.match(source,/status\.textContent='FAIL/);
});
