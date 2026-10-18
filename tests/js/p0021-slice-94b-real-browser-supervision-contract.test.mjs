/** S94b: guard explicit ownership, real Worker proof and absence of shadow timeout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const active=load('../browser/p0021-slice-83-active-ir-worker.mjs');
const proof=load('../browser/p0021-slice-94b-worker-supervision.mjs');
const page=load('../browser/p0021-slice-94b-worker-supervision.html');
const fixture=load('../browser/p0021-slice-94b-transport-fixture-worker.mjs');
test('S94b: active non-legacy real-Pyodide DocumentRuntime smoke explicitly owns supervised Worker',()=>{
  assert.match(active,/new Worker\(new URL\('\.\.\/\.\.\/src\/js\/evaluation\/selected-pyodide-worker\.js'/);
  assert.match(active,/createRuntimeFunctionBatchEvaluator\(/);
  assert.match(active,/supervision:\s*\{timeoutMs:180_000,maxPending:1\}/);
  assert.match(active,/return client\.evaluate\(envelope,selection\)/);
  assert.doesNotMatch(active,/Promise\.race|function timed\(/);
});
test('S94b: Worker lifetime has one owner, with failed-construction fallback',()=>{
  assert.match(active,/if\(client\) client\.close\(\)/);
  assert.match(active,/else worker\?\.terminate\(\)/);
  assert.doesNotMatch(active,/client\?\.close\(\);worker\?\.terminate\(\)/);
});
test('S94b: browser proof uses actual separate module Workers and stable terminal codes',()=>{
  assert.match(page,/p0021-slice-94b-worker-supervision\.mjs/);
  assert.match(proof,/new Worker\(new URL\('\.\/p0021-slice-94b-transport-fixture-worker\.mjs'/);
  for (const code of ['WORKER_TIMEOUT','WORKER_CRASH','WORKER_PENDING_LIMIT','WORKER_CLIENT_CLOSED'])
    assert.match(proof,new RegExp(code));
  assert.match(proof,/EXPECTED_TEST_FAILURE/);
  assert.match(fixture,/throw new Error\('S94b deliberate Worker crash'\)/);
  assert.match(fixture,/source === 'hang'/);
  assert.doesNotMatch(fixture,/Pyodide|SymPy|eval\(/);
});
