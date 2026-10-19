/** P0021 S95a — bounded STATIC import-reachability audit.
 * No code execution, no claim to discover event handlers, runtime branches,
 * Python imports or dynamic import() targets. This is migration evidence,
 * not an architecture proof or a permission to remove modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ENTRIES = Object.freeze({
  studentUi: 'src/js/main.js',
  selectedWorker: 'src/js/evaluation/selected-pyodide-worker.js',
  realBrowserProbe: 'tests/browser/p0021-slice-83-active-ir-worker.mjs',
});
const LEGACY = Object.freeze([
  'src/js/cas-engine.js',
  'src/js/transformer.js',
  'src/js/python-files.js',
  'src/js/legacy/compile-legacy-unit.js',
]);

function rel(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}
function assertInside(root, absolute) {
  const relative = path.relative(root, absolute);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error(`Import escapes or aliases repository root: ${relative}`);
  }
}

/** Enumerate *static* relative JS imports/reexports. Handles multiline declarations and
 * query-string cache tags; ignores import() expressions. Deliberately bounded
 * and conservative (not a full ECMAScript parser).
 */
export function staticRelativeImports(source) {
  if (typeof source !== 'string') throw new TypeError('source must be text');
  // Remove block comments before scanning. Keep line counts for diagnostics.
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\r\n]/g, ' '));
  const lines = withoutBlocks.split(/\r?\n/);
  const imports = new Set();
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i];
    if (!/^\s*(?:import\s+(?!\()|export\s+(?=[*{]))/.test(start) || /^\s*\/\//.test(start)) continue;
    const group = [];
    for (let j = i; j < Math.min(lines.length, i + 16); j++) {
      group.push(lines[j]);
      const statement = group.join('\n');
      const bare = /^\s*import\s*(['"])([^'"\r\n]+)\1/.exec(statement);
      const from = /\bfrom\s*(['"])([^'"\r\n]+)\1/.exec(statement);
      const found = bare?.[2] ?? from?.[2];
      if (found) {
        if (found.startsWith('.')) imports.add(found);
        i = j;
        break;
      }
      if (j > i && /^\s*(?:import\s|export\s|(?:const|let|class|function)\s)/.test(lines[j])) break;
      if (statement.length > 1800 || /;\s*(?:\/\/.*)?$/.test(lines[j])) break;
    }
  }
  return [...imports].sort();
}

function resolveImport(root, sourceRel, target) {
  const pathname = target.split(/[?#]/, 1)[0];
  const absolute = path.resolve(root, path.dirname(sourceRel), pathname);
  assertInside(root, absolute);
  const candidates = path.extname(absolute) ? [absolute] : [absolute + '.js', absolute + '.mjs', path.join(absolute, 'index.js')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return rel(root, candidate);
  }
  return null;
}

export function traceStaticGraph(root, entry) {
  const base = path.resolve(root);
  const seen = new Set();
  const pending = [entry];
  const edges = [];
  const unresolved = [];
  const dynamicHints = [];
  while (pending.length) {
    const file = pending.shift();
    if (seen.has(file)) continue;
    const absolute = path.resolve(base, file);
    assertInside(base, absolute);
    if (!fs.existsSync(absolute)) throw new Error(`Entrypoint/import missing: ${file}`);
    seen.add(file);
    const contents = fs.readFileSync(absolute, 'utf8');
    if (/\bimport\s*\(/.test(contents)) dynamicHints.push(file);
    for (const specifier of staticRelativeImports(contents)) {
      const resolved = resolveImport(base, file, specifier);
      if (!resolved) unresolved.push({from: file, specifier});
      else {
        edges.push({from: file, to: resolved});
        if (!seen.has(resolved)) pending.push(resolved);
      }
    }
  }
  return {
    entry,
    modules: [...seen].sort(),
    edges: edges.sort((a,b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    unresolved: unresolved.sort((a,b) => a.from.localeCompare(b.from)),
    dynamicHints: dynamicHints.sort(),
  };
}

function hasText(root, file, needle) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  return source.includes(needle);
}

export function buildLegacyRouteAudit(root) {
  const base = path.resolve(root);
  const routes = Object.fromEntries(Object.entries(ENTRIES).map(([name, file]) => [name, traceStaticGraph(base, file)]));
  const status = {
    uiDirectlyImportsLegacy: routes.studentUi.modules.includes('src/js/cas-engine.js') && routes.studentUi.modules.includes('src/js/transformer.js'),
    selectedWorkerStaticallyFreeOfLegacy: LEGACY.every(m => !routes.selectedWorker.modules.includes(m)),
    browserProbeStaticallyFreeOfLegacy: LEGACY.every(m => !routes.realBrowserProbe.modules.includes(m)),
    documentRuntimeHasLegacyDelegates: ['this.engine.calculate(', 'this.engine.getTaskState(', 'this.engine.resetTask('].every(s => hasText(base, 'src/js/document-runtime.js', s)),
    pythonLegacyExecutionPresent: hasText(base, 'src/python/core/executor.py', 'def run_in_task(') && hasText(base, 'src/python/core/executor.py', 'eval('),
    releaseBlocksStudentShipping: hasText(base, 'tools/release/student-preview.mjs', 'STUDENT RELEASE BLOCKED'),
  };
  const unexpectedLegacy = Object.entries(routes).filter(([name, r]) => name !== 'studentUi' && LEGACY.some(m => r.modules.includes(m))).map(([name])=>name);
  const problems = [
    ...Object.entries(routes).flatMap(([name, r]) => r.unresolved.map(item => ({type: 'unresolved-static-import', route: name, ...item}))),
    ...unexpectedLegacy.map(route => ({type: 'unexpected-legacy-reachability', route})),
  ];
  return {
    schema: 'newCAS/p0021-s95a-legacy-route-audit/v1',
    evidence: 'bounded-static-import-graph plus explicit textual probes; not runtime/event-handler/Python reachability',
    entries: ENTRIES,
    legacyModules: LEGACY,
    routes,
    status,
    problems,
    next: [
      'Trace index.html to real user events and the selected runtime entrypoint, then plan UI cutover.',
      'Map DocumentRuntime calculate/getTaskState/resetTask legacy APIs and direct test consumers.',
      'Map Python bootstrap/run_in_task/reset/task_registry consumers before deleting backend files.',
      'Preserve release block until real UI and end-to-end Pyodide/document behavior are verified.',
    ],
  };
}

export function formatLegacyRouteAudit(audit) {
  const fmt = value => value ? 'YES' : 'NO';
  const lines = [
    '# P0021 S95a — bounded legacy migration route audit', '',
    `Method: ${audit.evidence}.`, '',
    '| Source observation | Found |', '|---|---|',
    ...Object.entries(audit.status).map(([name, value]) => `| ${name} | ${fmt(value)} |`), '',
    '## Static import routes', '',
    '| Route | Entry | Reachable JS modules | Legacy modules | Unresolved imports |',
    '|---|---|---:|---|---:|',
    ...Object.entries(audit.routes).map(([name, r])=> {
      const legacy = audit.legacyModules.filter(m => r.modules.includes(m));
      return `| ${name} | \`${r.entry}\` | ${r.modules.length} | ${legacy.length ? legacy.map(x=>'`'+x+'`').join(', ') : 'none found'} | ${r.unresolved.length} |`;
    }), '',
    '## Direct migration blockers / remaining evidence', '',
    '1. `src/js/main.js` still constructs `Transformer` and `CASEngine` and dispatches UI cell evaluations via `engine.calculate` (verify actual HTML entrypoint separately).',
    '2. `DocumentRuntime` still exposes legacy delegation APIs alongside the separate Semantic IR orchestration.',
    '3. `src/python/bootstrap.py`, `core/executor.py` and `core/scope.py` still implement the legacy Python task scope. Do not delete until callers are migrated.',
    '4. The selected Worker and its independent real browser probe have no statically reachable legacy JS modules *in this bounded graph*.',
    '5. Preview-only release must remain blocked; no pupil release from this audit.', '',
    '## Known limits', '',
    '- Static relative imports/reexports only; dynamic `import()` targets, HTML wiring, external scripts, runtime branch behavior, CSS/DOM, Worker construction, Python imports and data-driven loading are NOT proven by this scan.',
    '- A static reference is not proof of actual execution. Absence of a static reference is not proof of runtime absence.',
    '- The audit intentionally does not edit, retire or replace any runtime code.', '',
    '## Potential dynamic import() occurrences (not followed)', '',
    ...Object.entries(audit.routes).map(([name, route]) => `- ${name}: ${route.dynamicHints.length ? route.dynamicHints.map(x => '`'+x+'`').join(', ') : 'none detected by lexical hint'}`), '',
    '## Next checks', '', ...audit.next.map(s => `- ${s}`), '',
    '## Audit warnings', '',
    ...(audit.problems.length ? audit.problems.map(x=>`- ${JSON.stringify(x)}`) : ['- No unresolved *relative static JS imports* in the three bounded graphs.']), '',
  ];
  return lines.join('\n');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root = rootIndex < 0 ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') : path.resolve(args[rootIndex + 1] || '.');
  const json = args.includes('--json');
  if (args.some((arg, i) => !['--root', '--json'].includes(arg) && i !== rootIndex + 1)) {
    console.error('Usage: node tools/analyze/p0021-s95a-legacy-route-audit.mjs [--root path] [--json]');
    process.exitCode = 2;
  } else {
    try {
      const audit = buildLegacyRouteAudit(root);
      console.log(json ? JSON.stringify(audit, null, 2) : formatLegacyRouteAudit(audit));
      if (audit.problems.length) process.exitCode = 1;
    } catch (error) {
      console.error(`S95a audit failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
