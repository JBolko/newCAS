/**
 * P0027/P0028 (selected subset): ephemeral linear authoritative-transaction
 * Undo/Redo. This session stores reversible operations and a history cursor,
 * NOT blocks, derived ASTs, runtime results, Value instances or Worker state.
 * DocumentRuntime remains the only authority for document mutations.
 */
const validRevision = revision => typeof revision === 'string' && revision.length > 0;

export function createDocumentHistorySession({runtime, editingSession,
  getCurrentRevision, advanceRevision} = {}) {
  if (!runtime || runtime.engine !== null ||
      typeof runtime.prepareDocumentTransaction !== 'function' ||
      typeof runtime.applyDocumentTransaction !== 'function' ||
      typeof runtime.getBlocks !== 'function' ||
      typeof runtime.getDocumentMutationIdentity !== 'function' ||
      typeof getCurrentRevision !== 'function' ||
      typeof advanceRevision !== 'function' ||
      !validRevision(getCurrentRevision()) ||
      (editingSession !== undefined && (!editingSession ||
        typeof editingSession.snapshot !== 'function'))) {
    throw new TypeError('S95O_HISTORY_CONTRACT');
  }
  const history = [];
  let cursor = 0;
  let busy = false;
  const fingerprint = () => JSON.stringify(runtime.getBlocks().map(b => [
    b.id, b.type, b.taskId ?? null, b.source ?? null,
  ])); // Short-lived divergence token, NOT a second document model.
  let expected = fingerprint();
  let expectedMutationIdentity = runtime.getDocumentMutationIdentity();

  function guard(operations = null, allowPendingSource = false) {
    if (busy) throw new Error('S95O_HISTORY_BUSY');
    const draft = editingSession?.snapshot();
    let acknowledge = null;
    if (draft != null) {
      // No structure, compound operations, Undo or Redo with a live draft.
      // Even the sole exception must match the already prepared proposal.
      const op = allowPendingSource && Array.isArray(operations) &&
        operations.length === 1 ? operations[0] : null;
      if (!draft.pending || !op || op.kind !== 'source' ||
          Object.keys(op).sort().join(',') !== 'blockId,kind,source' ||
          op.blockId !== draft.blockId || op.source !== draft.source ||
          typeof editingSession.prepareHistoryCommit !== 'function') {
        throw new Error('S95O_ACTIVE_DRAFT');
      }
      acknowledge = editingSession.prepareHistoryCommit({blockId:op.blockId,source:op.source});
    }
    if (runtime.getDocumentMutationIdentity() !== expectedMutationIdentity ||
        fingerprint() !== expected) throw new Error('S95O_HISTORY_DIVERGED');
    return acknowledge;
  }
  function commit(operations) {
    const plan = runtime.prepareDocumentTransaction(operations); // zero mutation
    if (!plan.changed) return {plan, outcome:{kind:'unchanged'}};
    const previous = getCurrentRevision();
    if (!validRevision(previous)) throw new TypeError('S95O_REVISION_INVALID');
    advanceRevision(); // monotonic even when undo returns to earlier source
    const after = getCurrentRevision();
    if (!validRevision(after) || after === previous)
      throw new Error('S95O_REVISION_UNCHANGED');
    const outcome = runtime.applyDocumentTransaction(plan); // single staged publication
    return {plan, outcome};
  }
  function exclusive(fn, operations = null, allowPendingSource = false) {
    const acknowledge = guard(operations, allowPendingSource);
    busy = true;
    try {return fn(acknowledge);} finally {busy = false;}
  }
  function execute(operations) {
    return exclusive((acknowledge) => {
      const before = expected;
      const {plan,outcome} = commit(operations);
      if (outcome.kind === 'unchanged') {
        acknowledge?.(); // An unchanged draft is still an accepted Enter.
        return outcome;
      }
      const after = fingerprint();
      history.splice(cursor); // new authoritative edit discards redo branch
      history.push(Object.freeze({forward:plan.forward,inverse:plan.inverse,before,after}));
      cursor++;
      expected = after;
      expectedMutationIdentity = runtime.getDocumentMutationIdentity();
      // Acknowledge only after history has recorded a successful source commit.
      acknowledge?.();
      return Object.freeze({...outcome,cursor});
    }, operations, true);
  }
  function undo() {
    return exclusive(() => {
      if (cursor === 0) return Object.freeze({kind:'unavailable'});
      const entry = history[cursor - 1];
      if (expected !== entry.after) throw new Error('S95O_HISTORY_DIVERGED');
      const {outcome} = commit(entry.inverse);
      if (outcome.kind !== 'applied' || fingerprint() !== entry.before)
        throw new Error('S95O_INVERSE_MISMATCH');
      cursor--;
      expected = entry.before;
      expectedMutationIdentity = runtime.getDocumentMutationIdentity();
      return Object.freeze({...outcome,cursor});
    });
  }
  function redo() {
    return exclusive(() => {
      if (cursor === history.length) return Object.freeze({kind:'unavailable'});
      const entry = history[cursor];
      if (expected !== entry.before) throw new Error('S95O_HISTORY_DIVERGED');
      const {outcome} = commit(entry.forward);
      if (outcome.kind !== 'applied' || fingerprint() !== entry.after)
        throw new Error('S95O_FORWARD_MISMATCH');
      cursor++;
      expected = entry.after;
      expectedMutationIdentity = runtime.getDocumentMutationIdentity();
      return Object.freeze({...outcome,cursor});
    });
  }
  return Object.freeze({execute,undo,redo,
    snapshot: () => Object.freeze({canUndo:cursor > 0,canRedo:cursor < history.length,
      cursor,length:history.length})});
}
