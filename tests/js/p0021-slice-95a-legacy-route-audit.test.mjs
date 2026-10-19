/** P0021 S95a: static-only migration inventory, no runtime changes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  staticRelativeImports, traceStaticGraph, buildLegacyRouteAudit, formatLegacyRouteAudit,
} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const makeFixture = () => fs.mkdtempSync(path.join(os.tmpdir(), 'newcas95a-'));
const write = (root, name, data) => {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, data, 'utf8');
};

test('S95a source import extraction: multiline, reexport, side-effect and cache-tagged imports', () => {
  assert.deepEqual(staticRelativeImports(`
    /* import x from './ignored-block.js' */
    // import x from './ignored-line.js';
    import { a,
      b } from './folder/a.js?v=42';
    import './side-effect.mjs';
    export {x} from './reexport.js';
    import p from 'node:fs';
    const d = import('./dynamic.mjs');
  `), ['./folder/a.js?v=42', './reexport.js', './side-effect.mjs']);
});

test('S95a trace: follows static relative imports, handles cycles and ignores unrelated files', t => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  write(root, 'src/js/main.js', "import './a.js';\nimport './b.js?v=old';\n");
  write(root, 'src/js/a.js', "import './main.js';\n");
  write(root, 'src/js/b.js', 'export const value = 2;\n');
  write(root, 'src/js/unrelated.js', "import './missing.js';\n");
  const graph = traceStaticGraph(root, 'src/js/main.js');
  assert.deepEqual(graph.modules, ['src/js/a.js', 'src/js/b.js', 'src/js/main.js']);
  assert.equal(graph.edges.length, 3);
  assert.deepEqual(graph.unresolved, []);
});

test('S95a trace: unresolved direct imports remain visible, not silently omitted', t => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  write(root, 'src/js/main.js', "import './missing.js';\n");
  const graph = traceStaticGraph(root, 'src/js/main.js');
  assert.deepEqual(graph.unresolved, [{from:'src/js/main.js',specifier:'./missing.js'}]);
});

test('S95a trace: refuses static relative imports escaping audit root', t => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  write(root, 'src/js/main.js', "import '../../../escape.js';\n");
  assert.throws(() => traceStaticGraph(root, 'src/js/main.js'), /escapes/);
});

test('S95a current UI has a concrete legacy import path and direct invocation', () => {
  const audit = buildLegacyRouteAudit(ROOT);
  assert.equal(audit.status.uiDirectlyImportsLegacy, true);
  assert.ok(audit.routes.studentUi.modules.includes('src/js/cas-engine.js'));
  assert.ok(audit.routes.studentUi.modules.includes('src/js/transformer.js'));
  const main = fs.readFileSync(path.join(ROOT, 'src/js/main.js'), 'utf8');
  assert.match(main, /engine\.calculate\(ast,\s*taskId\)/);
});

test('S95a new selected Worker and live Pyodide browser probe are statically isolated from legacy', () => {
  const audit = buildLegacyRouteAudit(ROOT);
  for (const route of ['selectedWorker','realBrowserProbe']) {
    assert.equal(audit.routes[route].unresolved.length, 0);
    assert.ok(audit.legacyModules.every(m => !audit.routes[route].modules.includes(m)));
  }
  assert.equal(audit.problems.length, 0);
});

test('S95a transitional delegates and legacy Python executor are still inventoried; release blocked', () => {
  const audit = buildLegacyRouteAudit(ROOT);
  assert.equal(audit.status.documentRuntimeHasLegacyDelegates, true);
  assert.equal(audit.status.pythonLegacyExecutionPresent, true);
  assert.equal(audit.status.releaseBlocksStudentShipping, true);
  const report = formatLegacyRouteAudit(audit);
  assert.match(report, /no claim|not runtime\/event-handler/i);
  assert.match(report, /DocumentRuntime/);
  assert.match(report, /NOT proven/);
});
