/** P0021 Slice 12: a Pyodide-backed, explicitly selected P0012 addition handler.
 * Worker-only intended; do not instantiate on the UI thread.
 * No source parser, Python task scope or operation-name registry.
 */
const FILES = [
  'src/__init__.py', 'src/python/__init__.py',
  'src/python/adapters/__init__.py',
  'src/python/adapters/sympy_value_adapter.py',
  'src/python/evaluator/__init__.py',
  'src/python/evaluator/_binary_expression_contract.py',
  'src/python/evaluator/scalar_operations.py',
  'src/python/evaluator/selected_gateway_bridge.py',
];
const PYTHON_ENTRY = `
import json
from src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway
from src.python.evaluator.scalar_operations import evaluate_scalar_request
_payload = json.loads(_newcas_request_json)
_result = evaluate_selected_gateway(_payload['envelope'], _payload['selection'], evaluate_scalar_request)
json.dumps(_result, allow_nan=False)
`;
const unique = (v) => JSON.parse(JSON.stringify(v));
export function createSelectedPyodideRuntime({loadPyodide, fetchText, indexURL} = {}) {
  if (typeof loadPyodide !== 'function' || typeof fetchText !== 'function' ||
      typeof indexURL !== 'string' || !indexURL) throw new TypeError('Pyodide loader, source loader and indexURL required');
  let initPromise;
  let instance;
  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const py = await loadPyodide({indexURL});
      await py.loadPackage('sympy');
      py.FS.mkdirTree('/newcas/src/python/evaluator');
      py.FS.mkdirTree('/newcas/src/python/adapters');
      for (const file of FILES) {
        // A transparent whitelist: files are fetched from the application's own origin.
        const source = file.endsWith('/__init__.py') ? '' : await fetchText(file);
        if (typeof source !== 'string') throw new TypeError(`invalid source: ${file}`);
        py.FS.writeFile(`/newcas/${file}`, source);
      }
      await py.runPythonAsync("import sys\nif '/newcas' not in sys.path: sys.path.insert(0, '/newcas')");
      instance = py;
      return py;
    })();
    try { return await initPromise; } catch (error) { initPromise = undefined; throw error; }
  }
  async function evaluateSelected(envelope, selection) {
    const py = await init();
    const e = unique(envelope), s = unique(selection);
    // This slice deliberately binds exactly one known P0012 capability.
    // Python gateway checks the selection and provider attestations again.
    if (s?.operationSpec?.evaluatorId !== 'probe.scalar.add' ||
        s?.evaluationRequest?.evaluatorId !== 'probe.scalar.add')
      throw new TypeError('unsupported selected evaluator in P0021 Slice 12');
    // Non-reentrant Python globals; the worker handler serializes requests.
    py.globals.set('_newcas_request_json', JSON.stringify({envelope:e,selection:s}));
    try {
      const response = await py.runPythonAsync(PYTHON_ENTRY);
      return unique(JSON.parse(response));
    } finally {
      py.globals.delete('_newcas_request_json');
    }
  }
  return Object.freeze({init,evaluateSelected});
}
