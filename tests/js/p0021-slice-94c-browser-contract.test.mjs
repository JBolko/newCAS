import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const proof=read('../browser/p0021-slice-94c-worker-recovery.mjs');
const page=read('../browser/p0021-slice-94c-worker-recovery.html');
const owner=read('../../src/js/evaluation/create-supervised-worker-owner.js');
test('S94c real browser proof uses explicit owner and actual separate module Workers',()=>{
  assert.match(page,/p0021-slice-94c-worker-recovery\.mjs/);
  assert.match(proof,/new Worker\(new URL\('\.\/p0021-slice-94b-transport-fixture-worker\.mjs'/);
  assert.match(proof,/h\.restart\(\)/);
  for (const code of ['WORKER_TIMEOUT','WORKER_CRASH','WORKER_CLIENT_CLOSED','WORKER_OWNER_CLOSED'])
    assert.match(proof,new RegExp(code));
  assert.doesNotMatch(proof,/from .*selected-pyodide-worker|createRuntimeFunctionBatchEvaluator/);
});
test('S94c owner strictly delegates to existing supervised transport',()=>{
  assert.match(owner,/createWorkerEvaluationClient\(/);
  assert.match(owner,/lease\.client\.evaluate\(envelope, selection\)/);
  assert.doesNotMatch(owner,/\b(?:new DocumentRuntime|parse\(|postMessage\(|getBlock\(|evaluateAndCommitSemanticTask\()/);
});
