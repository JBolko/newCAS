import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('tests/browser/p0021-symbolic-diff-worker-smoke.html','utf8');
const js=readFileSync('tests/browser/p0021-symbolic-diff-worker-smoke.mjs','utf8');
test('Slice 25 has a real browser module and explicit user action',()=>{
 assert.match(html,/id="run"/);assert.match(html,/p0021-symbolic-diff-worker-smoke\.mjs\?v=slice25-symbolic-diff-browser-v1/);
 assert.match(js,/new Worker\(/);assert.match(js,/createWorkerEvaluationClient/);
});
test('Slice 25 passes through document-owned source and selected P0010 compiler',()=>{
 for(const token of ['parse(source)','compileSelectedSourceAst','compileSelectedSymbolicDiff','LexicalIdentityScope','client.evaluate'])assert.ok(js.includes(token),token);
 assert.match(js,/diff\(x\^2,x\)/);assert.match(js,/diff\(A,x\)/);
});
test('Slice 25 cache-busts Worker and test module URLs independently',()=>{
 assert.match(js,/selected-pyodide-worker\.js\?v=slice25-symbolic-diff-browser-v1/);
 assert.match(html,/symbolic-diff-browser-v1/);
});
test('Slice 25 asserts actual backend result and exact symbol identity',()=>{
 assert.match(js,/outcome.status!=='success'/);assert.match(js,/target.identity/);assert.match(js,/value.data.expr/);
 assert.match(js,/second.value.data.expr.value!=='0'/);
});
