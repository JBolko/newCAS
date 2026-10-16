import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=rel=>readFileSync(new URL(`../../${rel}`,import.meta.url),'utf8');
test('S82 browser exercises the production DocumentRuntime batch, not retired adapters',()=>{
 const script=read('tests/browser/p0021-slice-82-active-ir-acceptance.mjs');
 assert.match(script,/createRuntimeFunctionBatchEvaluator/);
 assert.match(script,/evaluateAndCommitSemanticTask/);
 assert.match(script,/f\(g\(4\)\)/);
 assert.match(script,/setBlockSource/);
 assert.doesNotMatch(script,/createBoundFunctionTaskEvaluator|createSourceComposedExpressionTaskEvaluator/);
});
test('S82 preserves old browser witness and bound adapter until actual replacement is browser-proven',()=>{
 for(const rel of ['src/js/semantics/create-bound-function-task-evaluator.js','tests/browser/p0021-function-worker-smoke.mjs','tests/js/p0021-bound-function-batch.test.mjs'])
  assert.ok(existsSync(new URL(`../../${rel}`,import.meta.url)),`Do not retire without replacement: ${rel}`);
});
test('S82 browser documents JS test backend and does not claim end-to-end Pyodide proof',()=>{
 assert.match(read('tests/browser/p0021-slice-82-active-ir-acceptance.html'),/JavaScript-testbackend/);
 assert.match(read('tests/browser/p0021-slice-82-active-ir-acceptance.mjs'),/tester ikke Python-Worker-kæden/);
});
