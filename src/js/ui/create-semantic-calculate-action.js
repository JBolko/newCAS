/**
 * P0021 Slice 95e — explicit UI calculation action for semantic-only documents.
 *
 * This boundary accepts DRAFT sources, validates all targets before any write,
 * commits changed sources to the existing DocumentRuntime, and invokes the
 * existing supervised semantic task session. It is NOT an EditingSession,
 * scheduler, source cache, evaluator, result renderer or legacy bridge.
 *
 * DocumentRuntime owns source, block state and invalidation. The host owns
 * evaluation revision; the session owns worker transport/evaluation. Errors
 * from the session retain their existing structured P0009 diagnostics.
 */
const validRevision = value => typeof value === 'string' && value.length > 0;

export function createSemanticCalculateAction({
  runtime, session, taskId = 'default', getCurrentRevision, advanceRevision,
  commitOperations,
} = {}) {
  if (!runtime || typeof runtime.getBlock !== 'function' ||
      typeof runtime.setBlockSource !== 'function' ||
      !session || typeof session.run !== 'function' ||
      typeof taskId !== 'string' || !taskId ||
      typeof getCurrentRevision !== 'function' ||
      typeof advanceRevision !== 'function' ||
      !validRevision(getCurrentRevision()) ||
      (commitOperations !== undefined &&
        (typeof commitOperations !== 'function' || runtime.engine !== null))) {
    throw new TypeError('S95E_ACTION_CONTRACT');
  }
  let running = false;

  // Validate the entire proposed UI edit before mutating ANY source. Do not
  // parse text here: incomplete formulas remain valid authoritative sources.
  function plan(drafts) {
    if (!Array.isArray(drafts) || drafts.length === 0) {
      throw new TypeError('S95E_DRAFTS_INVALID');
    }
    const seen = new Set();
    const changes = [];
    for (const row of drafts) {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          typeof row.blockId !== 'string' || !row.blockId ||
          typeof row.source !== 'string' || seen.has(row.blockId)) {
        throw new TypeError('S95E_DRAFTS_INVALID');
      }
      seen.add(row.blockId);
      const block = runtime.getBlock(row.blockId);
      if (!block || block.type !== 'formula' || block.taskId !== taskId) {
        throw new TypeError('S95E_BLOCK_NOT_IN_TASK');
      }
      if (row.source !== block.source) {
        changes.push(Object.freeze({blockId:row.blockId,source:row.source}));
      }
    }
    return Object.freeze(changes);
  }

  // Explicit whole-document formula fixture mode. The list below is only a
  // transient transaction proposal; DocumentRuntime remains the authority.
  function documentOperations(drafts) {
    if (commitOperations === undefined || runtime.engine !== null)
      throw new TypeError('S97B_DOCUMENT_CONTRACT');
    const blocks = runtime.getBlocks();
    if (blocks.some(b => b.type !== 'formula' || b.taskId !== taskId))
      throw new TypeError('S97B_DOCUMENT_CONTRACT');
    if (!Array.isArray(drafts) || drafts.length === 0)
      throw new TypeError('S95E_DRAFTS_INVALID');
    const seen = new Set();
    for (const row of drafts) {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          typeof row.blockId !== 'string' || !row.blockId ||
          typeof row.source !== 'string' || seen.has(row.blockId))
        throw new TypeError('S95E_DRAFTS_INVALID');
      seen.add(row.blockId);
    }
    const operations = blocks.filter(b => !seen.has(b.id))
      .map(b => ({kind:'remove',blockId:b.id}));
    const order = blocks.filter(b => seen.has(b.id)).map(b => b.id);
    for (const [index,row] of drafts.entries()) {
      const oldIndex = order.indexOf(row.blockId);
      if (oldIndex === -1) {
        operations.push({kind:'insert',blockId:row.blockId,index,taskId,source:row.source});
        order.splice(index,0,row.blockId);
      } else {
        if (oldIndex !== index) {
          operations.push({kind:'move',blockId:row.blockId,index});
          order.splice(oldIndex,1); order.splice(index,0,row.blockId);
        }
        if (runtime.getBlock(row.blockId).source !== row.source)
          operations.push({kind:'source',blockId:row.blockId,source:row.source});
      }
    }
    return operations.length ? operations : drafts.map(row =>
      ({kind:'source',blockId:row.blockId,source:row.source}));
  }

  async function calculate(drafts, {onSourceAccepted,reconcileStructure=false} = {}) {
    if (running) throw new Error('S95E_ACTION_ALREADY_RUNNING');
    if (onSourceAccepted !== undefined && typeof onSourceAccepted !== 'function')
      throw new TypeError('S95E_ACTION_CONTRACT');
    if (typeof reconcileStructure !== 'boolean') throw new TypeError('S97B_DOCUMENT_CONTRACT');
    running = true;
    try {
      if (reconcileStructure) {
        const operations = documentOperations(drafts);
        const accepted = commitOperations(operations);
        if (accepted?.kind !== 'applied' && accepted?.kind !== 'unchanged')
          throw new Error('S96B_SOURCE_NOT_ACCEPTED');
        onSourceAccepted?.();
        return await session.run();
      }
      const changes = plan(drafts);
      // S96a.2 (temporary S95i-compatible boundary): a multi-source user action
      // must publish through the existing atomic S95n transaction. Prepare
      // BEFORE advancing the host epoch, so invalid operations cannot consume
      // a revision, and an intervening host edit is rejected as a stale plan.
      // The non-history single-source S95i route retains its live-block
      // contract; source identity is tracked independently by DocumentRuntime.
      const batchPlan = commitOperations === undefined &&
        changes.length > 1 && runtime.engine === null
        ? runtime.prepareDocumentTransaction(changes.map(change => ({
            kind:'source', blockId:change.blockId, source:change.source,
          })))
        : null;
      if (commitOperations !== undefined && (changes.length || onSourceAccepted)) {
        // HistorySession owns both revision advancement and one Undo entry.
        // Never double-increment the epoch or write through setBlockSource.
        // An unchanged Enter must also cross history's exact-proposal guard.
        // Its no-op transaction preserves revision, history and the redo branch.
        const proposals = changes.length ? changes : drafts;
        const accepted = commitOperations(proposals.map(change => Object.freeze({
          kind:'source',blockId:change.blockId,source:change.source,
        })));
        if (accepted?.kind !== 'applied' && accepted?.kind !== 'unchanged')
          throw new Error('S96B_SOURCE_NOT_ACCEPTED');
        // This synchronous event is separate from the evaluation promise.
        // Callback failure cannot roll back accepted source or recorded history.
        onSourceAccepted?.();
      } else if (changes.length) {
        const previous = getCurrentRevision();
        if (!validRevision(previous)) throw new TypeError('S95E_REVISION_INVALID');
        advanceRevision(); // MUST be synchronous, before the first source edit
        const current = getCurrentRevision();
        if (!validRevision(current) || current === previous) {
          throw new TypeError('S95E_REVISION_UNCHANGED');
        }
        if (batchPlan !== null) {
          runtime.applyDocumentTransaction(batchPlan);
        } else {
          // The single-formula selected route preserves S95i object identity.
          // Explicit legacy-engine compatibility retains its existing sequential
          // behavior until retirement; it is NOT a fallback from an S95n error.
          for (const change of changes) {
            runtime.setBlockSource(change.blockId,change.source);
          }
        }
      }
      // No automatic retry, fallback evaluator, result conversion or UI text.
      return await session.run();
    } finally {
      running = false;
    }
  }

  return Object.freeze({calculate});
}

/**
 * P0021 S95j — selected Enter action: P0026 EditingSession owns the draft;
 * S95e owns authoritative source mutation/evaluation. This thin UI action
 * does not parse, allocate identities, handle DOM state or retry the Worker.
 *
 * Returning null means no Enter submission took place (including IME text
 * composition and modified Enter). A handled Enter suppresses browser default
 * synchronously, before any asynchronous evaluation begins.
 */
export async function submitFormulaEditorEnter({event, editingSession, calculateAction} = {}) {
  if (!event || typeof event.preventDefault !== 'function' ||
      !editingSession || typeof editingSession.prepareCommit !== 'function' ||
      typeof editingSession.finishCommit !== 'function' ||
      typeof editingSession.retryDraft !== 'function' ||
      !calculateAction || typeof calculateAction.calculate !== 'function') {
    throw new TypeError('S95J_ENTER_CONTRACT');
  }
  if (event.key !== 'Enter' || event.shiftKey || event.altKey ||
      event.ctrlKey || event.metaKey || event.repeat || event.isComposing ||
      event.keyCode === 229) {
    return null;
  }
  event.preventDefault();
  const proposal = editingSession.prepareCommit(); // Verify block identity/base first.
  let sourceAccepted = false;
  try {
    const result = await calculateAction.calculate([proposal], {
      onSourceAccepted: () => {
        // Only the history-integrated action invokes this callback.
        // Once accepted, late settlement must never touch another draft.
        sourceAccepted = true;
        editingSession.finishCommit();
      },
    });
    if (!sourceAccepted) editingSession.finishCommit(); // Source authority remains in DocumentRuntime.
    return result;
  } catch (error) {
    if (sourceAccepted) throw error;
    // Evaluation may fail AFTER the source has been committed. In that case
    // close the draft: an old buffer must not be used to undo authoritative
    // source merely because the Worker is unavailable.
    try {
      editingSession.finishCommit();
    } catch {
      // Pre-commit validation failures leave the draft intact where safe.
      // If the document has concurrently changed, retryDraft rejects;
      // preserve the pending guard and surface the ORIGINAL failure.
      try { editingSession.retryDraft(); } catch { /* fail closed */ }
    }
    throw error;
  }
}
