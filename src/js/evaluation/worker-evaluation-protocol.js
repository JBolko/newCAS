import {decodeValue} from '../values/value.js';
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
 */
export function createWorkerEvaluationClient({worker, getCurrentRevision} = {}) {
  if (!worker || typeof worker.postMessage !== 'function' ||
      typeof worker.addEventListener !== 'function' || typeof worker.removeEventListener !== 'function' ||
      typeof getCurrentRevision !== 'function') throw new TypeError('worker and revision reader required');
  let next = 0;
  let closed = false;
  const pending = new Map();
  const receive = event => {
    const message = event?.data;
    if (!isRecord(message) || message.protocol !== PROTOCOL || message.kind !== 'result' ||
        !validString(message.requestId)) return;
    const entry = pending.get(message.requestId);
    if (!entry) return;
    pending.delete(message.requestId);
    if (entry.revision !== getCurrentRevision()) {
      entry.reject(new Error('STALE_REVISION'));
      return;
    }
    if (message.revision !== entry.revision || message.blockId !== entry.blockId) {
      entry.reject(new Error('WORKER_CORRELATION_MISMATCH'));
      return;
    }
    if (!isRecord(message.outcome) || message.outcome.blockId !== entry.blockId ||
        !['success','failure'].includes(message.outcome.status)) {
      entry.reject(new Error('INVALID_WORKER_OUTCOME'));
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
      entry.reject(new Error('INVALID_WORKER_VALUE'));
    }
  };
  worker.addEventListener('message', receive);
  function evaluate(envelope, selection) {
    if (closed) return Promise.reject(new Error('WORKER_CLIENT_CLOSED'));
    const e = snapshot(envelope), s = snapshot(selection);
    validatePayload(e,s);
    if (e.revision !== getCurrentRevision()) return Promise.reject(new Error('STALE_REVISION'));
    const requestId = `evaluation-${++next}`;
    return new Promise((resolve,reject) => {
      pending.set(requestId,{resolve,reject,revision:e.revision,blockId:e.blockId});
      try { worker.postMessage({protocol:PROTOCOL,kind:'evaluate',requestId,revision:e.revision,blockId:e.blockId,envelope:e,selection:s}); }
      catch (err) { pending.delete(requestId); reject(err); }
    });
  }
  function close() {
    if (closed) return;
    closed = true;
    worker.removeEventListener('message',receive);
    for (const p of pending.values()) p.reject(new Error('WORKER_CLIENT_CLOSED'));
    pending.clear();
  }
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
