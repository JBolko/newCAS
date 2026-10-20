/** S96b RED acceptance: Enter/history integration and commit acknowledgment.
 * These failures are EXPECTED on S96a.2. No production code changes.
 * No Worker is simulated as successful: the failure case is explicit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';

function setup() {
  const runtime=DocumentRuntime.createSemantic('s96b-red');
  for(const [id,source] of [['a','a:=2'],['r','a+1']])
    runtime.addBlock({id,type:'formula',taskId:'T',source});
  let n=0;
  const getCurrentRevision=()=>`r${n}`;
  const advanceRevision=()=>{n++;};
  const editingSession=createFormulaEditingSession({runtime,taskId:'T'});
  const history=createDocumentHistorySession({runtime,editingSession,getCurrentRevision,advanceRevision});
  return {runtime,editingSession,history,getCurrentRevision,advanceRevision,get revisionCount(){return n;}};
}

// P1: the actual Enter user action must be recorded as a new history entry,
// not an out-of-band DocumentRuntime.setBlockSource call.
test('S96b RED: Enter is one history action; Undo and Redo remain available',async()=>{
  const s=setup();
  s.history.execute([{kind:'source',blockId:'a',source:'a:=3'}]);
  s.editingSession.begin('r');s.editingSession.replaceSource('a+2');
  const action=createSemanticCalculateAction({
    runtime:s.runtime,session:{run:async()=>({kind:'complete'})},taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,
    // S96b intended injection; S96a.2 doesn't yet connect this entrypoint.
    commitOperations: operations=>s.history.execute(operations),
  });
  await submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},
    editingSession:s.editingSession,calculateAction:action});
  assert.equal(s.editingSession.snapshot(),null);
  assert.deepEqual(s.history.snapshot(),{canUndo:true,canRedo:false,cursor:2,length:2});
  assert.equal(s.history.undo().kind,'applied');
  assert.equal(s.runtime.getBlock('r').source,'a+1');
  assert.equal(s.history.redo().kind,'applied');
  assert.equal(s.runtime.getBlock('r').source,'a+2');
});

// A pending EditingSession draft must be accepted by the authoritative history
// boundary if and only if the operation exactly matches the pending proposal.
// HistorySession owns the commit acknowledgment; identity must then be checked
// by a non-reusable source/edit token rather than comparing block references.
test('S96b RED: exact pending draft may commit through history and close editor',()=>{
  const s=setup();
  s.editingSession.begin('r');s.editingSession.replaceSource('a+5');
  const proposal=s.editingSession.prepareCommit();
  const outcome=s.history.execute([{kind:'source',...proposal}]);
  assert.equal(outcome.kind,'applied');
  assert.equal(s.runtime.getBlock('r').source,'a+5');
  s.editingSession.finishCommit();
  assert.equal(s.editingSession.snapshot(),null);
  assert.deepEqual(s.history.snapshot(),{canUndo:true,canRedo:false,cursor:1,length:1});
});

// Positive safety baseline: delete+recreate with same ID/source must not
// silently complete the old edit, even if a naive source-only check would pass.
test('S96b positive: deleted/recreated block with same ID and source cannot ACK old edit',()=>{
  const s=setup();
  s.editingSession.begin('r');s.editingSession.replaceSource('a+5');
  s.editingSession.prepareCommit();
  const plan=s.runtime.prepareDocumentTransaction([
    {kind:'remove',blockId:'r'},
    {kind:'insert',blockId:'r',index:1,taskId:'T',source:'a+5'},
  ]);
  s.runtime.applyDocumentTransaction(plan);
  assert.throws(()=>s.editingSession.finishCommit(),/S95I_BLOCK_IDENTITY_STALE|S96B_EDIT_CONFLICT/);
});
