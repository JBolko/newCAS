import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../browser/p0021-runtime-async-captures-worker-smoke.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../browser/p0021-runtime-async-captures-worker-smoke.mjs',import.meta.url),'utf8');
test('S59 browser uses real module Worker with versioned cache-bust URL',()=>{assert.match(js,/new Worker\(new URL\('\.\.\/\.\.\/src\/js\/evaluation\/selected-pyodide-worker\.js\?v=/);assert.match(js,/createWorkerEvaluationClient/);});
test('S59 browser executes existing DocumentRuntime and function capture batch',()=>{assert.match(js,/evaluateAndCommitDirtySemanticTask/);assert.match(js,/createRuntimeFunctionBatchEvaluator/);assert.match(js,/f\(t\):=t\+x/);});
test('S59 browser requires stale old round and task B isolation',()=>{assert.match(js,/\.kind!=='stale'/);assert.match(js,/val\(rt,'B-call'\)!=='103'/);});
test('S59 HTML imports matching versioned browser module',()=>{assert.match(html,/p0021-runtime-async-captures-worker-smoke\.mjs\?v=slice59-runtime-async-captures-v1/);});
