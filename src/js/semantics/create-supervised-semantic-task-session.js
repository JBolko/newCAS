/**
 * P0021 S94e: explicit application-level bridge for supervised transport and
 * document-owned selective evaluation. This is NOT a second DocumentRuntime,
 * scheduler, evaluator, cache, or Python scope.
 *
 * The host owns source revisions. An explicit restart MUST advance the host's
 * revision synchronously *before* the previous Worker is replaced; otherwise
 * any batch already awaiting completion could still commit under its old token.
 * A restart never automatically replays a calculation. Call run() explicitly.
 */
import {createSupervisedWorkerOwner} from '../evaluation/create-supervised-worker-owner.js';
import {createWorkerTransportError} from '../evaluation/worker-transport-diagnostics.js';

const validRevision = v => typeof v === 'string' && v.length > 0;

export function createSupervisedSemanticTaskSession({
  runtime, taskId = 'default', createWorker, supervision,
  getCurrentRevision, advanceRevision, createEvaluate,
} = {}) {
  if (!runtime || typeof runtime.evaluateAndCommitDirtySemanticTask !== 'function' ||
      !validRevision(taskId) || typeof createWorker !== 'function' ||
      supervision === undefined || typeof getCurrentRevision !== 'function' ||
      typeof advanceRevision !== 'function' || typeof createEvaluate !== 'function' ||
      !validRevision(getCurrentRevision())) {
    throw new TypeError('S94e requires a document runtime, task, supervised Worker, revision authority and evaluator factory');
  }

  // This object owns ONLY the transport; it never reads or writes block state.
  const workerOwner = createSupervisedWorkerOwner({createWorker,getCurrentRevision,supervision});
  let closed = false;
  let active = null;

  const requireOpen = () => {
    if (closed) throw new Error('SEMANTIC_SESSION_CLOSED');
  };
  function invalidateRevision() {
    const old = getCurrentRevision();
    if (!validRevision(old)) throw new TypeError('current revision must be nonempty');
    // The caller, not transport, chooses the fresh document evaluation revision.
    advanceRevision();
    const next = getCurrentRevision();
    if (!validRevision(next) || next === old) {
      throw new TypeError('advanceRevision must synchronously change the current revision');
    }
    return next;
  }

  function run() {
    requireOpen();
    if (active) return Promise.reject(new Error('SEMANTIC_TASK_ALREADY_RUNNING'));
    const revision = getCurrentRevision();
    if (!validRevision(revision)) return Promise.reject(new TypeError('invalid current revision'));
    const lease = {};
    active = lease;
    try {
      const result = runtime.evaluateAndCommitDirtySemanticTask(taskId, {
        revision,
        // A run-local lease protects against an old batch even if external
        // revision management is misconfigured or a restart fails.
        getCurrentRevision: () => active === lease && !closed ? getCurrentRevision() : null,
        createEvaluate: ({snapshot,revision:batchRevision,cachedOutcomes}) => {
          // Source/name semantics and provider selection belong to the supplied
          // P0021 evaluator. The Worker remains only its selected-value backend.
          return createEvaluate({snapshot,revision:batchRevision,cachedOutcomes,
            evaluateSelected: (envelope,selection) => {
              if (closed || active !== lease || getCurrentRevision() !== revision) {
                throw createWorkerTransportError('WORKER_GENERATION_STALE');
              }
              return workerOwner.evaluate(envelope,selection);
            }});
        },
      });
      return Promise.resolve(result).finally(() => {
        if (active === lease) active = null;
      });
    } catch (error) {
      if (active === lease) active = null;
      return Promise.reject(error);
    }
  }

  function restart() {
    requireOpen();
    // Fail closed on a broken revision authority; do not silently permit a
    // stale document commit when the caller cannot revoke old computations.
    let revision;
    try { revision = invalidateRevision(); }
    catch (error) {
      closed = true;
      active = null;
      workerOwner.close();
      throw error;
    }
    active = null; // prior asynchronous runner is now irrevocably stale
    workerOwner.restart(); // no replay, no change to authoritative source
    return revision;
  }

  function close() {
    if (closed) return;
    let failed;
    if (active) {
      try { invalidateRevision(); }
      catch (error) { failed = error; }
    }
    closed = true;
    active = null;
    workerOwner.close();
    if (failed) throw failed;
  }

  return Object.freeze({run,restart,close});
}
