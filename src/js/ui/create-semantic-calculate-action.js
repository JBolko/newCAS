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
} = {}) {
  if (!runtime || typeof runtime.getBlock !== 'function' ||
      typeof runtime.setBlockSource !== 'function' ||
      !session || typeof session.run !== 'function' ||
      typeof taskId !== 'string' || !taskId ||
      typeof getCurrentRevision !== 'function' ||
      typeof advanceRevision !== 'function' ||
      !validRevision(getCurrentRevision())) {
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

  async function calculate(drafts) {
    if (running) throw new Error('S95E_ACTION_ALREADY_RUNNING');
    running = true;
    try {
      const changes = plan(drafts);
      if (changes.length) {
        const previous = getCurrentRevision();
        if (!validRevision(previous)) throw new TypeError('S95E_REVISION_INVALID');
        advanceRevision(); // MUST be synchronous, before the first source edit
        const current = getCurrentRevision();
        if (!validRevision(current) || current === previous) {
          throw new TypeError('S95E_REVISION_UNCHANGED');
        }
        for (const change of changes) {
          runtime.setBlockSource(change.blockId,change.source);
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
  try {
    const result = await calculateAction.calculate([proposal]);
    editingSession.finishCommit(); // Source authority remains in DocumentRuntime.
    return result;
  } catch (error) {
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
