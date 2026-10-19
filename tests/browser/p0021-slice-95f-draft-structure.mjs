/**
 * P0021 S95f — TEST HARNESS ONLY: reconcile draft FORMULA order with an
 * existing semantic-only DocumentRuntime on the user's explicit Calculate.
 * Calls the runtime's own structural methods; owns no document model, evaluator
 * or persistence. Not an atomic editing transaction (P0026–P0028 remain open).
 */
import {validateS95fDrafts} from './p0021-slice-95f-test-fixture.mjs';

export function reconcileS95fDraftStructure({runtime, taskId, advanceRevision, getCurrentRevision}, proposed) {
  if (!runtime || typeof runtime.getBlocks !== 'function' ||
      typeof runtime.insertBlock !== 'function' ||
      typeof runtime.removeBlock !== 'function' ||
      typeof runtime.moveBlock !== 'function' ||
      typeof advanceRevision !== 'function' ||
      typeof getCurrentRevision !== 'function' || !taskId)
    throw new TypeError('S95F_RUNTIME_CONTRACT');
  const drafts = validateS95fDrafts(proposed); // full draft validation BEFORE any edit
  const old = runtime.getBlocks();
  if (old.some(block => block.type !== 'formula' || block.taskId !== taskId))
    throw new TypeError('S95F_FOREIGN_DOCUMENT');
  const before = old.map(b=>b.id);
  const ids = drafts.map(b=>b.id);
  const changed = ids.length !== before.length || ids.some((id,i)=>id!==before[i]);
  if (!changed) return false;
  // Revision is caller-owned. Advance before the FIRST structural write.
  // Caller must serialize Calculate UI actions; no background replay.
  const prior = getCurrentRevision();
  if (typeof prior !== 'string' || !prior) throw new TypeError('S95F_REVISION_INVALID');
  advanceRevision();
  const next = getCurrentRevision();
  if (typeof next !== 'string' || !next || next === prior)
    throw new TypeError('S95F_REVISION_UNCHANGED');
  const wanted = new Set(ids);
  for (const id of before) if (!wanted.has(id)) runtime.removeBlock(id);
  for (let i=0; i<ids.length; i++) {
    const id=ids[i];
    const current=runtime.getBlocks().findIndex(b=>b.id===id);
    if (current===-1) {
      runtime.insertBlock({id,type:'formula',taskId,source:drafts[i].source},i);
    } else if(current!==i) runtime.moveBlock(id,i);
  }
  return true;
}
