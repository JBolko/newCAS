/** P0021 S95b: selected UI PILOT only, never a production cutover. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const pilot='tests/browser/p0021-slice-95b-selected-ui-pilot.mjs';
const page='tests/browser/p0021-slice-95b-selected-ui-pilot.html';

test('S95b pilot reaches DocumentRuntime, selected evaluator and supervised session without legacy imports',()=>{
  const graph=traceStaticGraph(ROOT,pilot);
  assert.deepEqual(graph.unresolved,[]);
  for (const suffix of ['cas-engine.js','transformer.js','python-files.js','legacy/compile-legacy-unit.js'])
    assert.equal(graph.modules.some(m=>m.endsWith(suffix)),false,suffix);
  for(const required of ['src/js/document-runtime.js','src/js/semantics/create-runtime-function-batch-evaluator.js',
    'src/js/semantics/create-supervised-semantic-task-session.js'])
    assert.ok(graph.modules.includes(required), required);
});
test('S95b intentionally leaves production main.js unchanged on legacy route',()=>{
  const main=read('src/js/main.js');
  assert.match(main,/import\s*\{\s*CASEngine\s*\}/);
  assert.match(main,/engine\.calculate\(ast,\s*taskId\)/);
  assert.doesNotMatch(main,/p0021-slice-95b-selected-ui-pilot/);
});
test('S95b browser page is non-production and has an explicit calculation boundary',()=>{
  const html=read(page);
  assert.match(html,/<html lang="da">/);
  assert.match(html,/<button[^>]*id="evaluate"/);
  assert.match(html,/id="accept"/);
  assert.match(html,/Ikke elev-UI eller release/);
  assert.match(html,/type="module" src="\.\/p0021-slice-95b-selected-ui-pilot\.mjs"/);
});
test('S95b source is committed through DocumentRuntime, never into a parallel cache',()=>{
  const js=read(pilot);
  assert.match(js,/createSemanticCalculateAction\(\{/);
  assert.match(js,/calculateAction\.calculate\(/);
  const action=read('src/js/ui/create-semantic-calculate-action.js');
  assert.match(action,/runtime\.setBlockSource\(change\.blockId,change\.source\)/);
  assert.match(action,/return await session\.run\(\)/);
  assert.match(js,/session\.restart\(\)/);
  assert.doesNotMatch(js,/\.calculate\(ast|\.run_in_task\(|new CASEngine|new Transformer/);
});
test('S95b only updates DOM with textContent, never interpolated innerHTML',()=>{
  const js=read(pilot);
  assert.doesNotMatch(js,/\.innerHTML\s*=|\.outerHTML\s*=|\.insertAdjacentHTML\s*\(|\beval\s*\(/);
  assert.match(js,/output\.textContent\s*=/);
  assert.match(js,/status\.textContent\s*=/);
});
test('S95b actual-Pyodide Worker path and no JS arithmetic fallback',()=>{
  const js=read(pilot);
  assert.match(js,/selected-pyodide-worker\.js/);
  assert.match(js,/new Worker\(/);
  assert.match(js,/evaluate:evaluateSelected/);
  assert.match(js,/f\(3\)=11/);
  assert.match(js,/f\(3\)=14/);
});

// S95b browser RED → GREEN: the real selected Pyodide Worker is an explicit
// evaluator-capability allowlist. A made-up pilot namespace is NOT authorized.
test('S95b selected OperationSpec evaluator IDs belong to actual Pyodide allowlist',()=>{
  const js=read(pilot);
  const worker=read('src/js/evaluation/selected-pyodide-runtime.js');
  const match=js.match(/evaluatorId:\s*`([^`]+)`/);
  assert.ok(match, 'pilot must declare explicit evaluator capability IDs');
  const selectedIds=['add','multiply','power'].map(id=>match[1].replace('${id}',id));
  assert.deepEqual(selectedIds,['probe.scalar.add','probe.scalar.multiply','probe.scalar.power']);
  for (const selectedId of selectedIds) {
    assert.ok(worker.includes(`'${selectedId}'`), `${selectedId} missing from Worker allowlist`);
  }
  assert.doesNotMatch(js,/pilot\.scalar\./);
});
