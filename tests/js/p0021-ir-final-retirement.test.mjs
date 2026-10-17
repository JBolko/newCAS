/** S84: assert the selected real-worker witness survives retirement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const removed=[
 'src/js/semantics/create-bound-function-task-evaluator.js',
 'tests/js/p0021-bound-function-batch.test.mjs',
 'tests/browser/p0021-function-worker-smoke.mjs',
 'tests/browser/p0021-function-worker-smoke.html',
];
test('S84: last historical adapter and its API/browser tests really retired',()=>{
 for(const path of removed)assert.equal(existsSync(resolve(root,path)),false,`historical artifact still present: ${path}`);
});
test('S84: production computation and real-Worker witness remain on active attested IR',()=>{
 const batch=read('src/js/semantics/create-runtime-function-batch-evaluator.js');
 const witness=read('tests/browser/p0021-slice-83-active-ir-worker.mjs');
 assert.match(batch,/createAttestedIRTaskEvaluator/);
 assert.doesNotMatch(batch,/createBoundFunctionTaskEvaluator/);
 for(const expected of [/createRuntimeFunctionBatchEvaluator/,/createWorkerEvaluationClient/,/client\.evaluate\(envelope,selection\)/,/f\(g\(4\)\)/])
  assert.match(witness,expected);
});
