/**
 * P0021 S95l — selected ONE-operation structural editing boundary (P0027 subset).
 *
 * The authoritative block list, dependency graph, and invalidation belong only
 * to DocumentRuntime. The UI supplies stable identities and an explicit action.
 * This is NOT a multi-operation transaction, Undo/Redo, ID allocator, or a
 * second document state. Every rejected proposal is checked before any write.
 */
const validRevision = x => typeof x === 'string' && x.length > 0;
const keys = (v, expected) => Object.keys(v).sort().join('|') === [...expected].sort().join('|');
// Block IDs are opaque DocumentRuntime identities, not DOM IDs or filenames.
const stableId = x => typeof x === 'string' && x.length > 0;

export function createFormulaStructuralAction({
  runtime, taskId, getCurrentRevision, advanceRevision, editingSession,
} = {}) {
  if (!runtime || runtime.engine !== null ||
      typeof runtime.getBlocks !== 'function' ||
      typeof runtime.getBlock !== 'function' ||
      typeof runtime.insertBlock !== 'function' ||
      typeof runtime.removeBlock !== 'function' ||
      typeof runtime.moveBlock !== 'function' ||
      typeof taskId !== 'string' || !taskId ||
      typeof getCurrentRevision !== 'function' ||
      typeof advanceRevision !== 'function' ||
      !validRevision(getCurrentRevision()) ||
      (editingSession !== undefined &&
        (!editingSession || typeof editingSession.snapshot !== 'function'))) {
    throw new TypeError('S95L_ACTION_CONTRACT');
  }

  function preflight(proposal) {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal))
      throw new TypeError('S95L_PROPOSAL_INVALID');
    const {kind, blockId, index, source} = proposal;
    const current = runtime.getBlocks();
    if (kind === 'insert') {
      if (!keys(proposal, ['kind','blockId','index','source']) ||
          !stableId(blockId) || typeof source !== 'string' ||
          runtime.getBlock(blockId) !== null ||
          !Number.isSafeInteger(index) || index < 0 || index > current.length)
        throw new TypeError('S95L_INSERT_INVALID');
      // Existing DocumentRuntime owns source preparation, including malformed
      // but valid string drafts. No parser or writer registry is introduced.
      runtime.prepareBlock({id:blockId,type:'formula',taskId,source});
      return Object.freeze({kind,blockId,index,source});
    }
    if (kind === 'remove') {
      if (!keys(proposal,['kind','blockId']) || !stableId(blockId))
        throw new TypeError('S95L_REMOVE_INVALID');
      const block=runtime.getBlock(blockId);
      if (!block || block.type !== 'formula' || block.taskId !== taskId)
        throw new TypeError('S95L_BLOCK_NOT_IN_TASK');
      return Object.freeze({kind,blockId});
    }
    if (kind === 'move') {
      if (!keys(proposal,['kind','blockId','index']) ||
          !stableId(blockId) || !Number.isSafeInteger(index) ||
          index < 0 || index >= current.length)
        throw new TypeError('S95L_MOVE_INVALID');
      const block=runtime.getBlock(blockId);
      if (!block || block.type !== 'formula' || block.taskId !== taskId)
        throw new TypeError('S95L_BLOCK_NOT_IN_TASK');
      return Object.freeze({kind,blockId,index});
    }
    throw new TypeError('S95L_PROPOSAL_INVALID');
  }

  function apply(proposal) {
    // No structural change can silently discard a user's active formula draft.
    if (editingSession && editingSession.snapshot() !== null)
      throw new Error('S95L_ACTIVE_FORMULA_DRAFT');
    const edit=preflight(proposal);
    const before=getCurrentRevision();
    if (!validRevision(before)) throw new TypeError('S95L_REVISION_INVALID');
    const blocks=runtime.getBlocks();
    const originalRefs=blocks.map(b=>runtime.getBlock(b.id));
    const oldIndex=blocks.findIndex(b=>b.id===edit.blockId);
    if (edit.kind==='move' && oldIndex===edit.index) return Object.freeze({kind:'unchanged'});
    // After this boundary there is exactly one synchronous runtime operation.
    // This is NOT a multi-step structural transaction or rollback engine.
    advanceRevision();
    const after=getCurrentRevision();
    if (!validRevision(after) || after===before) throw new TypeError('S95L_REVISION_UNCHANGED');
    // A host revision callback is not allowed to mutate document sources/order.
    const now=runtime.getBlocks();
    if (now.length!==blocks.length || blocks.some((b,i)=>
      now[i].id!==b.id || now[i].type!==b.type || now[i].source!==b.source ||
      now[i].taskId!==b.taskId || now[i].calculation?.generation!==b.calculation?.generation ||
      runtime.getBlock(b.id)!==originalRefs[i])) {
      throw new Error('S95L_STRUCTURE_CHANGED_DURING_REVISION');
    }
    let affected;
    if (edit.kind==='insert') {
      affected=runtime.insertBlock({id:edit.blockId,type:'formula',taskId,source:edit.source},edit.index);
      affected=new Set([edit.blockId,...affected]);
    } else if (edit.kind==='remove') {
      affected=runtime.removeBlock(edit.blockId);
    } else {
      affected=runtime.moveBlock(edit.blockId,edit.index);
    }
    return Object.freeze({kind:'applied',blockId:edit.blockId,
      affectedBlockIds:Object.freeze([...affected]),revision:after});
  }

  return Object.freeze({apply});
}
