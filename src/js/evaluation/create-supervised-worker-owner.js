/**
 * P0021 S94c: explicit lifecycle owner for successive supervised Worker clients.
 *
 * Transport ONLY: no document, evaluator, OperationSpec, Python or automatic replay.
 * An explicit restart irrevocably invalidates the preceding Worker generation.
 * DocumentRuntime remains the sole authority for document edits/results.
 */
import {createWorkerEvaluationClient} from './worker-evaluation-protocol.js';
import {createWorkerTransportError} from './worker-transport-diagnostics.js';

export function createSupervisedWorkerOwner({createWorker, getCurrentRevision, supervision} = {}) {
  if (typeof createWorker !== 'function' || typeof getCurrentRevision !== 'function' ||
      supervision === undefined) {
    throw new TypeError('explicit Worker factory, revision reader and supervision required');
  }

  let disposed = false;
  let generation = 0;
  let current = null;

  function open() {
    // The caller supplies a fresh, exclusively owned Worker each time.
    const worker = createWorker();
    let client;
    try {
      client = createWorkerEvaluationClient({worker, getCurrentRevision, supervision});
    } catch (error) {
      // Construction failed before ownership passed to the transport client.
      try { worker?.terminate?.(); } catch { /* fail closed */ }
      throw error;
    }
    current = Object.freeze({generation: ++generation, client});
    return current.generation;
  }

  function restart() {
    if (disposed) throw createWorkerTransportError('WORKER_OWNER_CLOSED');
    // Invalidate BEFORE terminating the previous Worker. No old outcome may
    // become authoritative even if it settled just before the restart.
    ++generation;
    const previous = current;
    current = null;
    previous?.client.close();
    return open();
  }

  async function evaluate(envelope, selection) {
    if (disposed) throw createWorkerTransportError('WORKER_OWNER_CLOSED');
    const lease = current;
    if (!lease) throw createWorkerTransportError('WORKER_OWNER_UNAVAILABLE');
    const outcome = await lease.client.evaluate(envelope, selection);
    if (disposed || current !== lease || generation !== lease.generation) {
      throw createWorkerTransportError('WORKER_GENERATION_STALE');
    }
    return outcome;
  }

  function close() {
    if (disposed) return;
    disposed = true;
    ++generation;
    const previous = current;
    current = null;
    previous?.client.close();
  }

  // Fail closed if the first factory call cannot make a supervised client.
  open();
  return Object.freeze({evaluate, restart, close});
}
