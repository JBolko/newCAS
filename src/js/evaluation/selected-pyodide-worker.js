/** P0021 Slice 12: module Worker entry point. Never imported by the main thread.
 * Uses Slice 11 transport and explicit Slice 12 Python gateway.
 */
import { createWorkerEvaluationHandler } from './worker-evaluation-protocol.js';
import { createSelectedPyodideRuntime } from './selected-pyodide-runtime.js?v=slice24-symbolic-diff-v1';

const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/';
const runtime = createSelectedPyodideRuntime({
  indexURL: CDN,
  loadPyodide: async options => {
    const {loadPyodide} = await import(`${CDN}pyodide.mjs`);
    return loadPyodide(options);
  },
  fetchText: async path => {
    const url = new URL(`../../${path.replace(/^src\//, '')}`, import.meta.url);
    // src/js/evaluation → ../../ = src; append python/... to reach src/python.
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Python source unavailable (${resp.status}): ${path}`);
    return resp.text();
  },
});
const handle = createWorkerEvaluationHandler({
  evaluateSelected: runtime.evaluateSelected,
  postMessage: message => self.postMessage(message),
});
// Serialize calls because Pyodide globals are shared and Python is synchronous.
let queue = Promise.resolve();
self.addEventListener('message', event => {
  queue = queue.then(() => handle(event), () => handle(event));
});
