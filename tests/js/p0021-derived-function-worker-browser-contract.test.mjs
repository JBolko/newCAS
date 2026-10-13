import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const load=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const source=load('../browser/p0021-derived-function-worker-smoke.mjs');
const html=load('../browser/p0021-derived-function-worker-smoke.html');
test('S37: browser loads a real module Worker and selected evaluation client',()=>{
 assert.match(source,/new Worker\(/);assert.match(source,/type:'module'/);assert.match(source,/createWorkerEvaluationClient\(/);
});
test('S37: derivative goes through selected FunctionValue request and real Worker',()=>{
 assert.match(source,/compileSelectedFunctionDerivative\(/);assert.match(source,/client\.evaluate\(source,selected\)/);
});
test('S37: real derivative is wrapped and applied via existing contracts',()=>{
 assert.match(source,/materializeSelectedDerivativeFunction\(/);assert.match(source,/evaluateSelectedFunctionApplication\(/);
});
test('S37: smoke checks original binder and values including 436',()=>{
 assert.match(source,/identityKey\(target\.identity\)/);assert.match(source,/await calculate\(12,436\)/);assert.match(source,/await calculate\(0,4\)/);assert.match(source,/await calculate\(1,7\)/);
});
test('S37: HTML, module and Worker are cache-versioned',()=>{
 assert.match(html,/slice38-shared-worker-value-v1/);assert.match(source,/selected-pyodide-worker\.js\?v=slice38-shared-worker-value-v1/);
});
