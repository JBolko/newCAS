/** P0021 Slice 18: explicitly selected scalar and trigonometric operations via Pyodide.
 * Worker-only intended; do not instantiate on the UI thread.
 * No source parser, Python task scope or operation-name registry.
 */
import {snapshotSelectedValueFields} from './worker-evaluation-protocol.js';
const FILES = [
  'src/__init__.py', 'src/python/__init__.py',
  'src/python/adapters/__init__.py',
  'src/python/adapters/sympy_value_adapter.py',
  'src/python/adapters/statistics_value_adapter.py',
  'src/python/evaluator/__init__.py',
  'src/python/evaluator/_binary_expression_contract.py',
  'src/python/evaluator/scalar_operations.py',
  'src/python/evaluator/scalar_differentiation.py',
  'src/python/evaluator/scalar_multiplication.py',
  'src/python/evaluator/scalar_power.py',
  'src/python/evaluator/scalar_exponential.py',
  'src/python/evaluator/scalar_logarithms.py',
  'src/python/evaluator/_unary_value_contract.py',
  'src/python/evaluator/_trigonometric_argument.py',
  'src/python/evaluator/scalar_trigonometry.py',
  'src/python/evaluator/list_mean.py',
  'src/python/evaluator/list_statistics.py',
  'src/python/evaluator/container_list.py',
  'src/python/evaluator/selected_gateway_bridge.py',
];
const PYTHON_ENTRY = `
import json
from src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway
from src.python.evaluator.scalar_operations import evaluate_scalar_request
from src.python.evaluator.scalar_differentiation import evaluate_diff_request
from src.python.evaluator.scalar_multiplication import evaluate_multiplication_request
from src.python.evaluator.scalar_power import evaluate_power_request
from src.python.evaluator.scalar_exponential import evaluate_exp_request
from src.python.evaluator.scalar_logarithms import evaluate_ln_request, evaluate_log10_request
from src.python.evaluator.scalar_trigonometry import evaluate_sine_request, evaluate_cosine_request, evaluate_tangent_request
from src.python.evaluator.list_mean import evaluate_mean_request
from src.python.evaluator.list_statistics import evaluate_variance_request, evaluate_standard_deviation_request
from src.python.evaluator.list_statistics import evaluate_sample_variance_request, evaluate_sample_standard_deviation_request
from src.python.evaluator.list_statistics import evaluate_median_request, evaluate_min_request, evaluate_max_request
from src.python.evaluator.list_statistics import evaluate_quartiles_request, evaluate_five_number_summary_request
from src.python.evaluator.list_statistics import evaluate_observation_values_request, evaluate_absolute_frequencies_request, evaluate_relative_frequencies_request
from src.python.evaluator.list_statistics import evaluate_cumulative_absolute_frequencies_request, evaluate_cumulative_relative_frequencies_request
from src.python.evaluator.container_list import evaluate_list_request
_payload = json.loads(_newcas_request_json)
_selected_id = _payload['selection']['operationSpec']['evaluatorId']
if _selected_id == 'probe.symbolic.diff':
    _handler = evaluate_diff_request
elif _selected_id == 'probe.scalar.add':
    _handler = evaluate_scalar_request
elif _selected_id == 'probe.scalar.multiply':
    _handler = evaluate_multiplication_request
elif _selected_id == 'probe.scalar.power':
    _handler = evaluate_power_request
elif _selected_id == 'probe.scalar.exp':
    _handler = evaluate_exp_request
elif _selected_id == 'probe.scalar.ln':
    _handler = evaluate_ln_request
elif _selected_id == 'probe.scalar.log10':
    _handler = evaluate_log10_request
elif _selected_id == 'probe.scalar.sin':
    _handler = evaluate_sine_request
elif _selected_id == 'probe.scalar.cos':
    _handler = evaluate_cosine_request
elif _selected_id == 'probe.scalar.tan':
    _handler = evaluate_tangent_request
elif _selected_id == 'probe.statistics.mean':
    _handler = evaluate_mean_request
elif _selected_id == 'probe.statistics.variance':
    _handler = evaluate_variance_request
elif _selected_id == 'probe.statistics.standard_deviation':
    _handler = evaluate_standard_deviation_request
elif _selected_id == 'probe.statistics.sample_variance':
    _handler = evaluate_sample_variance_request
elif _selected_id == 'probe.statistics.sample_standard_deviation':
    _handler = evaluate_sample_standard_deviation_request
elif _selected_id == 'probe.statistics.median':
    _handler = evaluate_median_request
elif _selected_id == 'probe.statistics.min':
    _handler = evaluate_min_request
elif _selected_id == 'probe.statistics.max':
    _handler = evaluate_max_request
elif _selected_id == 'probe.statistics.quartiles':
    _handler = evaluate_quartiles_request
elif _selected_id == 'probe.statistics.five_number_summary':
    _handler = evaluate_five_number_summary_request
elif _selected_id == 'probe.statistics.observation_values':
    _handler = evaluate_observation_values_request
elif _selected_id == 'probe.statistics.absolute_frequencies':
    _handler = evaluate_absolute_frequencies_request
elif _selected_id == 'probe.statistics.relative_frequencies':
    _handler = evaluate_relative_frequencies_request
elif _selected_id == 'probe.statistics.cumulative_absolute_frequencies':
    _handler = evaluate_cumulative_absolute_frequencies_request
elif _selected_id == 'probe.statistics.cumulative_relative_frequencies':
    _handler = evaluate_cumulative_relative_frequencies_request
elif _selected_id == 'probe.container.list':
    _handler = evaluate_list_request
else:
    raise ValueError('unsupported selected evaluator')
_result = evaluate_selected_gateway(_payload['envelope'], _payload['selection'], _handler)
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
    const {envelope:e,selection:s}=snapshotSelectedValueFields(envelope,selection);
    const py = await init();
    // Static transport-level handler allowlist; operation selection remains in JS.
    // Python gateway checks the selection and provider attestations again.
    if (!['probe.scalar.add','probe.scalar.multiply','probe.scalar.sin','probe.scalar.cos','probe.scalar.tan','probe.scalar.power','probe.scalar.exp','probe.scalar.ln','probe.scalar.log10','probe.symbolic.diff','probe.statistics.mean','probe.statistics.variance','probe.statistics.standard_deviation','probe.statistics.sample_variance','probe.statistics.sample_standard_deviation','probe.statistics.median','probe.statistics.min','probe.statistics.max','probe.statistics.quartiles','probe.statistics.five_number_summary','probe.statistics.observation_values','probe.statistics.absolute_frequencies','probe.statistics.relative_frequencies','probe.statistics.cumulative_absolute_frequencies','probe.statistics.cumulative_relative_frequencies','probe.container.list'].includes(s?.operationSpec?.evaluatorId) ||
        s?.evaluationRequest?.evaluatorId !== s?.operationSpec?.evaluatorId)
      throw new TypeError('unsupported selected evaluator in P0021 Slice 17');
    if (['probe.scalar.sin','probe.scalar.cos','probe.scalar.tan'].includes(s.operationSpec.evaluatorId) &&
        (!s.evaluationRequest.options ||
         Object.keys(s.evaluationRequest.options).length !== 1 ||
         !['deg','rad'].includes(s.evaluationRequest.options.angleUnit)))
      throw new TypeError('trigonometric operation requires explicit angleUnit deg or rad');
    if (['probe.scalar.power','probe.scalar.exp','probe.scalar.ln','probe.scalar.log10'].includes(s.operationSpec.evaluatorId) &&
        (s.evaluationRequest.options === null || typeof s.evaluationRequest.options !== 'object' ||
         Array.isArray(s.evaluationRequest.options) || Object.keys(s.evaluationRequest.options).length !== 0))
      throw new TypeError('selected scalar family requires empty options');
    if (s.operationSpec.evaluatorId === 'probe.symbolic.diff' &&
        (s.evaluationRequest.options === null || typeof s.evaluationRequest.options !== 'object' ||
         Array.isArray(s.evaluationRequest.options) || Object.keys(s.evaluationRequest.options).length !== 0 ||
         s.evaluationRequest.instruction === null || typeof s.evaluationRequest.instruction !== 'object' ||
         Array.isArray(s.evaluationRequest.instruction) || Object.keys(s.evaluationRequest.instruction).length !== 0 ||
         !Array.isArray(s.evaluationRequest.inputs) || s.evaluationRequest.inputs.length !== 2 ||
         s.evaluationRequest.inputs[1]?.kind !== 'expression' ||
         s.evaluationRequest.inputs[1]?.data?.expr?.op !== 'symbolRef'))
      throw new TypeError('selected differentiation requires explicit symbolRef target and empty options/instruction');
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
