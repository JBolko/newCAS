import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../browser/${name}`,import.meta.url),'utf8');
const script=read('p0021-slice-72-p0004-worker-acceptance.mjs');
const html=read('p0021-slice-72-p0004-worker-acceptance.html');
test('acceptance page runs one self-contained, user-triggered browser suite',()=>{
 assert.match(html,/id="run"/);
 assert.match(html,/p0021-slice-72-p0004-worker-acceptance\.mjs/);
 assert.match(script,/run\.addEventListener\('click'/);
 assert.match(script,/finally\s*\{/);
});
test('acceptance checks actual versions of Pyodide, Python and SymPy',()=>{
 assert.match(script,/py\.version/);assert.match(script,/sys\.version_info/);
 assert.match(script,/sympy\.__version__/);assert.match(script,/314\.0\.7/);
 assert.match(script,/3,14,2/);assert.match(script,/1\.14\.0/);
});
test('acceptance uses the new module Worker and checks successful and failed outcomes',()=>{
 assert.match(script,/selected-pyodide-worker\.js/);
 assert.match(script,/type:'module'/);
 assert.match(script,/createWorkerEvaluationClient/);
 assert.match(script,/isExactInteger\(first,5\)/);
 assert.match(script,/isExactInteger\(second,7\)/);
 assert.match(script,/providerId='wrong-writer'/);
 assert.match(script,/third\?\.status!=='failure'/);
 assert.match(script,/worker\?\.terminate\(\)/);
});
