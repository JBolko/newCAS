/**
 * P0021 S95i — selected FormulaBlock EditingSession boundary (P0026 subset).
 *
 * Exactly one transient editor buffer, addressed by a DocumentRuntime-owned
 * block ID and task ID. No DOM ownership, ID allocation, parser, evaluator,
 * document mutation or revision authority lives here. The S95e Calculate
 * action remains the ONLY path from a draft proposal to authoritative source.
 *
 * This does NOT implement structural transactions, history or Undo/Redo.
 */
export function createFormulaEditingSession({runtime, taskId} = {}) {
  if (!runtime || runtime.engine !== null ||
      typeof runtime.getBlock !== 'function' ||
      typeof runtime.getBlockSourceIdentity !== 'function' ||
      typeof taskId !== 'string' || taskId.length === 0) {
    throw new TypeError('S95I_EDITING_SESSION_CONTRACT');
  }

  let edit = null;
  const requireEdit = () => {
    if (!edit) throw new Error('S95I_NO_ACTIVE_DRAFT');
    return edit;
  };
  const snapshot = () => edit === null ? null : Object.freeze({
    blockId: edit.blockId, taskId, source: edit.source,
    pending: edit.pending,
  });
  function currentBlock(active) {
    const block = runtime.getBlock(active.blockId);
    // S96b.1: a successful S95n source transaction replaces the block object.
    // Only the exact replacement acknowledged synchronously by HistorySession
    // is allowed to finish this pending edit; delete/recreate remains stale.
    if ((block !== active.block && block !== active.historyCommittedBlock) ||
        block?.type !== 'formula' || block.taskId !== taskId) {
      throw new Error('S95I_BLOCK_IDENTITY_STALE');
    }
    return block;
  }
  function verifyBase(active) {
    const block = currentBlock(active);
    if (runtime.getBlockSourceIdentity(active.blockId) !== active.baseIdentity ||
        block.source !== active.baseSource ||
        block.calculation?.generation !== active.baseGeneration) {
      throw new Error('S95I_EDIT_CONFLICT');
    }
    return block;
  }
  function begin(blockId) {
    if (edit) throw new Error('S95I_DRAFT_ALREADY_ACTIVE');
    if (typeof blockId !== 'string' || !blockId) throw new TypeError('S95I_BLOCK_ID_INVALID');
    const block = runtime.getBlock(blockId);
    if (!block || block.type !== 'formula' || block.taskId !== taskId ||
        typeof block.source !== 'string' || !Number.isSafeInteger(block.calculation?.generation)) {
      throw new Error('S95I_BLOCK_NOT_IN_TASK');
    }
    edit = {block, blockId, baseIdentity:runtime.getBlockSourceIdentity(blockId),
      baseSource:block.source,
      baseGeneration:block.calculation.generation, source:block.source, pending:false};
    return snapshot();
  }
  function replaceSource(source) {
    const active = requireEdit();
    if (active.pending) throw new Error('S95I_COMMIT_PENDING');
    if (typeof source !== 'string') throw new TypeError('S95I_SOURCE_INVALID');
    active.source = source; // Incomplete/malformed input remains a valid DRAFT.
    return snapshot();
  }
  function prepareCommit() {
    const active = requireEdit();
    if (active.pending) throw new Error('S95I_COMMIT_PENDING');
    verifyBase(active); // Before invoking S95e's authoritative source action.
    active.pending = true;
    return Object.freeze({blockId: active.blockId, source: active.source});
  }
  /**
   * Authorize ONLY a pending source proposal still based on its original block.
   * HistorySession receives a one-use acknowledgment callback, which it invokes
   * after an authoritative S95n commit has been recorded in history.
   * No runtime mutation or second document model lives in EditingSession.
   */
  function prepareHistoryCommit(proposal) {
    const active = requireEdit();
    if (!active.pending || !proposal || proposal.blockId !== active.blockId ||
        proposal.source !== active.source ||
        Object.keys(proposal).sort().join(',') !== 'blockId,source') {
      throw new Error('S95O_ACTIVE_DRAFT');
    }
    verifyBase(active);
    let acknowledged = false;
    return () => {
      if (acknowledged) return;
      acknowledged = true;
      // Invoked synchronously by HistorySession after it records the commit;
      // no other mutation can interleave with its transaction publication.
      if (edit === active) {
        active.historyCommittedBlock = runtime.getBlock(active.blockId);
        active.historyCommittedIdentity = runtime.getBlockSourceIdentity(active.blockId);
      }
    };
  }

  function finishCommit() {
    const active = requireEdit();
    if (!active.pending) throw new Error('S95I_NO_PENDING_COMMIT');
    const block = currentBlock(active);
    if (active.historyCommittedIdentity !== undefined &&
        runtime.getBlockSourceIdentity(active.blockId) !== active.historyCommittedIdentity)
      throw new Error('S96B_EDIT_CONFLICT');
    if (block.source !== active.source) throw new Error('S95I_COMMIT_NOT_APPLIED');
    edit = null; // No session-owned authoritative source or result cache.
  }
  function retryDraft() {
    const active = requireEdit();
    if (!active.pending) throw new Error('S95I_NO_PENDING_COMMIT');
    // If the Calculate action has already committed the source but evaluation
    // failed, that source is AUTHORITATIVE. Do not turn it into an old draft.
    const block = currentBlock(active);
    if (runtime.getBlockSourceIdentity(active.blockId) !== active.baseIdentity ||
        block.source !== active.baseSource ||
        block.calculation?.generation !== active.baseGeneration) {
      throw new Error('S95I_EDIT_CONFLICT');
    }
    active.pending = false;
    return snapshot();
  }
  function cancel() {
    const active = requireEdit();
    if (active.pending) throw new Error('S95I_COMMIT_PENDING');
    edit = null; // No document/source/generation/revision edits.
  }
  return Object.freeze({begin, replaceSource, snapshot, prepareCommit,
    prepareHistoryCommit, finishCommit, retryDraft, cancel});
}
