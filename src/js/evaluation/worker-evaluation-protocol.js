import {decodeValue} from '../values/value.js';
import {createWorkerTransportError} from './worker-transport-diagnostics.js';
/** P0021 Slice 11: transport of preselected evaluations across a Worker boundary.
 * No parser, OperationSpec selection, Python registry or document-owned state here.
 * The worker must be handed a backend-neutral handler by its bootstrap code.
 */
export const PROTOCOL = 'newcas.selected-worker.v1';
const safe = v => {
  try {
    const s = JSON.stringify(v);
    return s !== undefined && JSON.parse(s) !== undefined ? JSON.parse(s) : undefined;
  } catch { return undefined; }
};
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const validString = v => typeof v === 'string' && v.length > 0;
function validatePayload(envelope, selection) {
  if (!isRecord(envelope) || envelope.protocol !== 'newcas.semantic-evaluation.v1' ||
      !validString(envelope.revision) || !validString(envelope.blockId) ||
      !validString(envelope.taskScopeId) || !validString(envelope.source) ||
      !Array.isArray(envelope.providers) || !isRecord(selection) ||
      envelope.revision !== selection.revision || envelope.blockId !== selection.blockId ||
      envelope.taskScopeId !== selection.taskScopeId || envelope.source !== selection.source ||
      !isRecord(selection.evaluationRequest) || !isRecord(selection.operationSpec)) {
    throw new TypeError('invalid or mismatched selected evaluation');
  }
}
function snapshot(value) {
  const copy = safe(value);
  if (copy === undefined || !isRecord(copy)) throw new TypeError('non-JSON-portable protocol payload');
  return copy;
}
/** Main-thread adapter. `worker` exposes postMessage, addEventListener, removeEventListener.
 * Always pass current document revision; late replies are rejected, not committed.
 *
 * S94a: `supervision` is explicitly opt-in. It transfers exclusive Worker ownership
 * to this client: fatal transport events or an expired deadline terminate the Worker
 * and reject ALL pending requests. Callers must create a fresh Worker/client to retry.
 * No timer can interrupt running synchronous Pyodide; termination is the boundary.
 */
export function createWorkerEvaluationClient({worker, getCurrentRevision, supervision} = {}) {
  if (!worker || typeof worker.postMessage !== 'function' ||
      typeof worker.addEventListener !== 'function' || typeof worker.removeEventListener !== 'function' ||
      typeof getCurrentRevision !== 'function') throw new TypeError('worker and revision reader required');
  let policy = null;
  if (supervision !== undefined) {
    if (!isRecord(supervision) || Object.keys(supervision).length !== 2 ||
        !Object.hasOwn(supervision, 'timeoutMs') || !Object.hasOwn(supervision, 'maxPending') ||
        !Number.isSafeInteger(supervision.timeoutMs) || supervision.timeoutMs < 1 ||
        supervision.timeoutMs > 2147483647 ||
        !Number.isSafeInteger(supervision.maxPending) || supervision.maxPending < 1 ||
        typeof worker.terminate !== 'function') {
      throw new TypeError('supervision requires timeoutMs (1..2147483647), maxPending (positive integer), and an exclusively owned terminable Worker');
    }
    policy = Object.freeze({timeoutMs: supervision.timeoutMs, maxPending: supervision.maxPending});
  }
  let next = 0;
  let closed = false;
  let terminalReason = 'WORKER_CLIENT_CLOSED';
  const pending = new Map();
  const settle = (requestId) => {
    const entry = pending.get(requestId);
    if (!entry) return undefined;
    pending.delete(requestId);
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    return entry;
  };
  const receive = event => {
    const message = event?.data;
    if (!isRecord(message) || message.protocol !== PROTOCOL || message.kind !== 'result' ||
        !validString(message.requestId)) return;
    const entry = settle(message.requestId);
    if (!entry) return;
    // If the document's revision authority itself fails, the settled entry
    // must still be rejected. Its timer has already been cleared by settle().
    // A thrown reader here previously stranded this Promise indefinitely.
    let currentRevision;
    try { currentRevision = getCurrentRevision(); }
    catch {
      entry.reject(createWorkerTransportError('WORKER_REVISION_UNAVAILABLE'));
      fatal('WORKER_REVISION_UNAVAILABLE');
      return;
    }
    if (entry.revision !== currentRevision) {
      entry.reject(new Error('STALE_REVISION'));
      return;
    }
    if (message.revision !== entry.revision || message.blockId !== entry.blockId) {
      entry.reject(createWorkerTransportError('WORKER_CORRELATION_MISMATCH'));
      return;
    }
    if (!isRecord(message.outcome) || message.outcome.blockId !== entry.blockId ||
        !['success','failure'].includes(message.outcome.status)) {
      entry.reject(createWorkerTransportError('INVALID_WORKER_OUTCOME'));
      return;
    }
    // A Worker clone/JSON boundary drops Object.freeze markers on public Values.
    // Rehydrate *once* at this shared boundary; never weaken P0005 validation.
    try {
      const outcome = snapshot(message.outcome);
      if (outcome.status === 'success') {
        if (!Object.hasOwn(outcome, 'value')) throw new TypeError('missing Value');
        outcome.value = decodeValue(JSON.stringify(outcome.value));
      }
      entry.resolve(Object.freeze(outcome));
    } catch {
      entry.reject(createWorkerTransportError('INVALID_WORKER_VALUE'));
    }
  };
  const fatal = (code) => {
    if (closed) return;
    closed = true;
    terminalReason = code;
    worker.removeEventListener('message', receive);
    if (policy) {
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onMessageError);
      // Worker.terminate() is the only viable cancellation for synchronous Pyodide.
      // A failed termination must not leave promises pending or allow new dispatches.
      try { worker.terminate(); } catch { /* fail closed at this client boundary */ }
    }
    for (const id of pending.keys()) settle(id)?.reject(
      createWorkerTransportError(code, code === 'WORKER_TIMEOUT' ? {timeoutMs: policy.timeoutMs} : {})
    );
  };
  const onError = () => fatal('WORKER_CRASH');
  const onMessageError = () => fatal('WORKER_MESSAGE_ERROR');
  worker.addEventListener('message', receive);
  if (policy) {
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);
  }
  function evaluate(envelope, selection) {
    if (closed) return Promise.reject(createWorkerTransportError(terminalReason,
      terminalReason === 'WORKER_TIMEOUT' ? {timeoutMs: policy.timeoutMs} : {}));
    const e = snapshot(envelope), s = snapshot(selection);
    validatePayload(e,s);
    let currentRevision;
    try { currentRevision = getCurrentRevision(); }
    catch {
      // Another request may already be pending. Terminal supervision rejects
      // it too; no guessed revision or automatic retry is permitted.
      fatal('WORKER_REVISION_UNAVAILABLE');
      return Promise.reject(createWorkerTransportError('WORKER_REVISION_UNAVAILABLE'));
    }
    if (e.revision !== currentRevision) return Promise.reject(new Error('STALE_REVISION'));
    if (policy && pending.size >= policy.maxPending) return Promise.reject(
      createWorkerTransportError('WORKER_PENDING_LIMIT', {maxPending: policy.maxPending}));
    const requestId = `evaluation-${++next}`;
    return new Promise((resolve,reject) => {
      const entry = {resolve,reject,revision:e.revision,blockId:e.blockId};
      pending.set(requestId,entry);
      if (policy) entry.timer = setTimeout(() => fatal('WORKER_TIMEOUT'), policy.timeoutMs);
      try { worker.postMessage({protocol:PROTOCOL,kind:'evaluate',requestId,revision:e.revision,blockId:e.blockId,envelope:e,selection:s}); }
      catch (err) { settle(requestId); reject(err); }
    });
  }
  function close() { fatal('WORKER_CLIENT_CLOSED'); }
  return Object.freeze({evaluate,close});
}
/** Worker-side event handler factory. `evaluateSelected` must enforce the P0021
 * selected Python gateway contract; transport does not select operations.
 */
export function createWorkerEvaluationHandler({evaluateSelected, postMessage} = {}) {
  if (typeof evaluateSelected !== 'function' || typeof postMessage !== 'function')
    throw new TypeError('worker handler and sender required');
  return async function onMessage(event) {
    const msg = event?.data;
    if (!isRecord(msg) || msg.protocol !== PROTOCOL || msg.kind !== 'evaluate' ||
        !validString(msg.requestId)) return;
    const base = {protocol:PROTOCOL,kind:'result',requestId:msg.requestId,
      revision:msg.revision,blockId:msg.blockId};
    try {
      const envelope = snapshot(msg.envelope), selection = snapshot(msg.selection);
      validatePayload(envelope,selection);
      if (msg.revision !== envelope.revision || msg.blockId !== envelope.blockId)
        throw new TypeError('request correlation mismatch');
      const outcome = snapshot(await evaluateSelected(envelope,selection));
      if (outcome.blockId !== envelope.blockId || !['success','failure'].includes(outcome.status))
        throw new TypeError('invalid evaluation outcome');
      postMessage({...base,outcome});
    } catch (error) {
      postMessage({...base,outcome:{blockId:msg.blockId,status:'failure',code:'WORKER_EVALUATION_ERROR',
        message: String(error?.message ?? error)}});
    }
  };
}
