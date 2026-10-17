/** P0021 Slice 81 — retire historical API, not normative behavior. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const exists=p=>existsSync(resolve(root,p));
const read=p=>readFileSync(resolve(root,p),'utf8');
const retired=[
 'src/js/semantics/create-source-literal-function-task-evaluator.js',
 'src/js/semantics/create-source-variable-function-task-evaluator.js',
 'tests/js/p0021-positional-function-evaluation.test.mjs',
 'tests/js/p0021-source-variable-function-task.test.mjs',
];
test('S81 retired source-call adapter implementations and API-only tests are absent',()=>{
 for(const path of retired) assert.equal(exists(path),false,`historical artifact still present: ${path}`);
});
test('S81/S84 current IR batch remains authoritative; historical bound adapter retired',()=>{
 const batch=read('src/js/semantics/create-runtime-function-batch-evaluator.js');
 assert.match(batch,/createAttestedIRTaskEvaluator/);
 assert.doesNotMatch(batch,/createSource(?:Literal|Variable)FunctionTaskEvaluator/);
 assert.equal(exists('src/js/semantics/create-bound-function-task-evaluator.js'),false);
 assert.equal(exists('tests/browser/p0021-function-worker-smoke.mjs'),false);
 assert.ok(exists('tests/browser/p0021-slice-83-active-ir-worker.mjs'));
 assert.match(read('tests/browser/p0021-slice-83-active-ir-worker.mjs'),/createRuntimeFunctionBatchEvaluator/);
});
