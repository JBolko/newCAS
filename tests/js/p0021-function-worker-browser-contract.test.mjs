import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../browser/p0021-function-worker-smoke.html',import.meta.url),'utf8');
const src=readFileSync(new URL('../browser/p0021-function-worker-smoke.mjs',import.meta.url),'utf8');
test('S33 browser loads versioned actual smoke module',()=>{
  assert.match(html,/p0021-function-worker-smoke\.mjs\?v=slice33-real-function-worker-v1/);
  assert.match(src,/new Worker\(new URL\('\.\.\/\.\.\/src\/js\/evaluation\/selected-pyodide-worker\.js\?v=slice33-real-function-worker-v1'/);
});
test('S33 browser uses real parser and FunctionValue materializer',()=>{
  assert.match(src,/parse\('f\(x\):=x\^3\+4x'\)/);
  assert.match(src,/compileSelectedFunctionDefinition\(/);
  assert.match(src,/materializeSelectedFunctionValue\(/);
});
test('S33 browser passes through existing bound batch evaluator and Worker client',()=>{
  assert.match(src,/createBoundFunctionTaskEvaluator\(/);
  assert.match(src,/dispatchSemanticEvaluationBatch\(/);
  assert.match(src,/createWorkerEvaluationClient\(/);
  assert.match(src,/client\.evaluate\(/);
});
test('S33 browser asserts exact results and denies wrong provider before Worker call',()=>{
  assert.match(src,/assertInteger\(first\.result\.state\.outcomes\[0\]\.value,'1776'\)/);
  assert.match(src,/assertInteger\(second\.result\.state\.outcomes\[0\]\.value,'39'\)/);
  assert.match(src,/providerId:'old-writer-f'/);
  assert.match(src,/rejected\.workerCalls!==0/);
});
