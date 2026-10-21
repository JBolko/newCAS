import {seedSemanticTask} from '../helpers/runtime-fixtures.js';
/**
 * S97a RED: history must reject accepted out-of-band mutation chronology.
 * Accepted S97a contract; original RED probes retained as GREEN regressions.
 * No TODO/skip or mock acceptance. Raw writes through exposed references
 * remain outside the public-API guarantee pending separate encapsulation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';
import {reconcileS95fDraftStructure} from '../browser/p0021-slice-95f-draft-structure.mjs';
import {expression} from '../../src/js/values/value.js';

function fixture() {
  const runtime=DocumentRuntime.createSemantic('s97a');
  runtime.addBlock({id:'r',type:'formula',taskId:'T',source:'1+2'});
  runtime.addBlock({id:'q',type:'formula',taskId:'T',source:'4+5'});
  let epoch=0;
  const getCurrentRevision=()=>String(epoch);
  const advanceRevision=()=>{epoch++;};
  const history=createDocumentHistorySession({runtime,getCurrentRevision,advanceRevision});
  const apply=ops=>runtime.applyDocumentTransaction(runtime.prepareDocumentTransaction(ops));
  const document=()=>runtime.getBlocks().map(({id,type,taskId,source})=>({id,type,taskId,source}));
  return {runtime,history,apply,document,getCurrentRevision,advanceRevision,get epoch(){return epoch;}};
}
const source=(source,blockId='r')=>({kind:'source',blockId,source});
const move=(index,blockId='r')=>({kind:'move',blockId,index});
const remove=blockId=>({kind:'remove',blockId});
const insert=(blockId,index=0,source='9')=>({kind:'insert',blockId,index,taskId:'T',source});

const externalMutations=[
  ['direct source ABA',s=>{
    const accepted=s.runtime.getBlock('r').source;
    s.runtime.setBlockSource('r','99');s.runtime.setBlockSource('r',accepted);
  }],
  ['remove/add same incarnation fields',s=>{
    const original=s.runtime.getBlock('q');
    s.runtime.removeBlock('q');s.runtime.addBlock({...original});
  }],
  ['remove/insert same ID and source',s=>{
    const original=s.runtime.getBlock('r');
    s.runtime.removeBlock('r');s.runtime.insertBlock({...original},0);
  }],
  ['move away and back',s=>{s.runtime.moveBlock('r',1);s.runtime.moveBlock('r',0);}],
  ['add/remove transient block',s=>{
    s.runtime.addBlock({id:'transient',type:'formula',taskId:'T',source:'9'});
    s.runtime.removeBlock('transient');
  }],
  ['insert/remove transient block',s=>{
    s.runtime.insertBlock({id:'transient',type:'formula',taskId:'T',source:'9'},1);
    s.runtime.removeBlock('transient');
  }],
  ['one transaction with source ABA',s=>{
    const accepted=s.runtime.getBlock('r').source;
    assert.equal(s.apply([source('99'),source(accepted)]).kind,'applied');
  }],
  ['one transaction with net-zero moves',s=>{assert.equal(s.apply([move(1),move(0)]).kind,'applied');}],
  ['one transaction with transient insert/remove',s=>{
    assert.equal(s.apply([insert('transient'),remove('transient')]).kind,'applied');
  }],
];
for(const [label,mutate] of externalMutations) for(const action of ['undo','redo','execute']) {
  test('S97a RED: '+action+' rejects '+label+' despite identical final content',()=>{
    const s=fixture();
    s.history.execute([source('7+9')]);
    if(action==='redo')s.history.undo();
    const expected=s.document();
    mutate(s);
    assert.deepEqual(s.document(),expected,'probe must restore identical document content');
    const history=s.history.snapshot(),epoch=s.epoch;
    const invoke=()=>action==='execute'?s.history.execute([source('8+9')]):s.history[action]();
    assert.throws(invoke,/S95O_HISTORY_DIVERGED/);
    assert.deepEqual(s.document(),expected);
    assert.deepEqual(s.history.snapshot(),history);
    assert.equal(s.epoch,epoch,'rejection must precede history host-epoch advance');
  });
}

test('S97a RED: a second history session cannot ABA around the first owner',()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  const competing=createDocumentHistorySession({runtime:s.runtime,
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision});
  competing.execute([source('99')]);competing.execute([source('7+9')]);
  assert.throws(()=>s.history.undo(),/S95O_HISTORY_DIVERGED/);
});

test('S97a RED: non-history Calculate ABA invalidates an existing history owner',async()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  const action=createSemanticCalculateAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision,
    session:{run:async()=>({kind:'complete'})}});
  await action.calculate([{blockId:'r',source:'99'}]);
  await action.calculate([{blockId:'r',source:'7+9'}]);
  const epoch=s.epoch;
  assert.throws(()=>s.history.undo(),/S95O_HISTORY_DIVERGED/);
  assert.equal(s.epoch,epoch);
});

test('S97a RED: structural action move ABA invalidates history',()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  const action=createFormulaStructuralAction({runtime:s.runtime,taskId:'T',
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision});
  action.apply(move(1));action.apply(move(0));
  assert.throws(()=>s.history.undo(),/S95O_HISTORY_DIVERGED/);
});

test('S97a RED: whole-document test-harness reconciliation cannot hide structural ABA',()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  const before=s.document().map(({id,source})=>({id,source}));
  const host={runtime:s.runtime,taskId:'T',getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision};
  reconcileS95fDraftStructure(host,[...before].reverse());
  reconcileS95fDraftStructure(host,before);
  assert.throws(()=>s.history.undo(),/S95O_HISTORY_DIVERGED/);
});

test('S97a RED: prepared transaction rejects structural ABA even when references/generations match',()=>{
  const s=fixture();
  const plan=s.runtime.prepareDocumentTransaction([source('7+9')]);
  s.runtime.moveBlock('r',1);s.runtime.moveBlock('r',0);
  assert.throws(()=>s.runtime.applyDocumentTransaction(plan),/S95N_STALE_PLAN/);
  assert.equal(s.runtime.getBlock('r').source,'1+2');
});

test('S97a RED: host revision callback cannot hide structural ABA inside prepared history commit',()=>{
  const s=fixture();let epoch=0;
  const history=createDocumentHistorySession({runtime:s.runtime,getCurrentRevision:()=>String(epoch),
    advanceRevision:()=>{
      epoch++;
      s.runtime.moveBlock('r',1);s.runtime.moveBlock('r',0);
    }});
  assert.throws(()=>history.execute([source('7+9')]),/S95N_STALE_PLAN/);
  assert.equal(s.runtime.getBlock('r').source,'1+2');
  assert.equal(history.snapshot().length,0);assert.equal(epoch,1,'already consumed epoch never rewinds');
});

test('S97a baseline: rejected proposal and prepare-only work do not diverge history',()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  s.runtime.prepareDocumentTransaction([source('99')]);
  assert.throws(()=>s.runtime.prepareDocumentTransaction([remove('missing')]),/S95N_REMOVE_INVALID/);
  assert.equal(s.history.undo().kind,'applied');
});

test('S97a baseline: unchanged move/source transactions preserve redo and host revision',()=>{
  const s=fixture();s.history.execute([source('7+9')]);s.history.undo();
  const history=s.history.snapshot(),epoch=s.epoch,identity=s.runtime.getBlockSourceIdentity('r');
  s.runtime.moveBlock('r',0);
  assert.equal(s.apply([source('1+2'),move(0)]).kind,'unchanged');
  assert.deepEqual(s.history.snapshot(),history);assert.equal(s.epoch,epoch);
  assert.equal(s.runtime.getBlockSourceIdentity('r'),identity);
  assert.equal(s.history.redo().kind,'applied');
});

for(const route of ['direct','transaction'])test('S97a baseline: failed '+route+' source publication does not diverge history',()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  const original=s.runtime.deriveSemanticTask;let calls=0;
  s.runtime.deriveSemanticTask=function(...args){
    if(++calls===2)throw new Error('S97_INJECTED');
    return original.apply(this,args);
  };
  try {
    assert.throws(()=>route==='direct'?s.runtime.setBlockSource('r','99'):s.apply([source('99')]),/S97_INJECTED/);
  } finally {s.runtime.deriveSemanticTask=original;}
  assert.equal(s.runtime.getBlock('r').source,'7+9');
  assert.equal(s.history.undo().kind,'applied');
});

test('S97a baseline: calculation invalidation and host-only revision changes are not source edits',async()=>{
  const s=fixture();s.history.execute([source('7+9')]);
  const block=s.runtime.getBlock('q');
  await seedSemanticTask(s.runtime,'T',{value:expression({op:'integer',value:'9'})});
  s.runtime.markBlockDirty('q');s.advanceRevision();
  assert.equal(block.calculation.generation,1);
  assert.equal(s.history.undo().kind,'applied');assert.equal(s.epoch,3);
});

test('S97a baseline: linear Undo/Redo advances epochs and does not restore source identities',()=>{
  const s=fixture(),initial=s.runtime.getBlockSourceIdentity('r');
  s.history.execute([source('7+9')]);
  const accepted=s.runtime.getBlockSourceIdentity('r');
  s.history.undo();
  assert.notEqual(s.runtime.getBlockSourceIdentity('r'),initial);
  assert.notEqual(s.runtime.getBlockSourceIdentity('r'),accepted);
  s.history.redo();assert.equal(s.epoch,3);
  s.history.undo();s.history.execute([source('8+9')]);
  assert.equal(s.history.snapshot().canRedo,false);assert.equal(s.epoch,5);
});

test('S97a baseline: published transaction observers cannot introduce another public mutation',()=>{
  const s=fixture();
  s.runtime.subscribeSemanticChanges(()=>s.runtime.setBlockSource('q','99'));
  assert.equal(s.history.execute([source('7+9')]).notificationErrors,1);
  assert.equal(s.runtime.getBlock('q').source,'4+5');
  assert.equal(s.history.undo().kind,'applied');
});

test('S97a baseline: exact pending draft remains historical and its ACK survives calculations only',()=>{
  const s=fixture();
  const editing=createFormulaEditingSession({runtime:s.runtime,taskId:'T'});
  const history=createDocumentHistorySession({runtime:s.runtime,editingSession:editing,
    getCurrentRevision:s.getCurrentRevision,advanceRevision:s.advanceRevision});
  editing.begin('r');editing.replaceSource('7+9');
  history.execute([{kind:'source',...editing.prepareCommit()}]);
  s.runtime.markBlockDirty('r');editing.finishCommit();
  assert.equal(history.undo().kind,'applied');
});

test('S97a baseline: old semantic result cannot publish after history edit and Undo',async()=>{
  const s=fixture();let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const pending=s.runtime.evaluateAndCommitSemanticTask('T',{
    revision:s.getCurrentRevision(),getCurrentRevision:s.getCurrentRevision,
    evaluate:async task=>{await gate;return {blockId:task.blockId,status:'success',
      value:expression({op:'integer',value:'999'})};}});
  s.history.execute([source('7+9')]);s.history.undo();release();
  assert.equal((await pending).kind,'stale');
  assert.equal(s.runtime.getBlock('r').calculation.result,null);assert.equal(s.epoch,2);
});

test('S97a stamp is runtime-owned, opaque and absent from block serialization',()=>{
  const s=fixture(),other=fixture(),stamp=s.runtime.getDocumentMutationIdentity();
  assert.equal(typeof stamp,'symbol');
  assert.notEqual(stamp,other.runtime.getDocumentMutationIdentity());
  assert.notEqual(stamp,s.runtime.getBlockSourceIdentity('r'));
  const before=JSON.stringify(s.runtime.getBlocks());
  s.runtime.getDocumentMutationIdentity();
  assert.equal(JSON.stringify(s.runtime.getBlocks()),before);
});

test('S97a direct same-source write is a mutation without a host revision',()=>{
  const s=fixture(),before=s.runtime.getDocumentMutationIdentity();
  const sourceIdentity=s.runtime.getBlockSourceIdentity('r');
  s.runtime.setBlockSource('r','1+2');
  assert.notEqual(s.runtime.getDocumentMutationIdentity(),before);
  assert.notEqual(s.runtime.getBlockSourceIdentity('r'),sourceIdentity);
  assert.equal(s.epoch,0);
  assert.throws(()=>s.history.execute([source('7+9')]),/S95O_HISTORY_DIVERGED/);
});

for(const method of ['add','insert'])test('S97a text '+method+'/remove ABA changes stamp despite no formula notification',()=>{
  const s=fixture(),before=s.runtime.getDocumentMutationIdentity();let notifications=0;
  s.runtime.subscribeSemanticChanges(()=>notifications++);
  const block={id:'text',type:'text',source:'a paragraph'};
  if(method==='add')s.runtime.addBlock(block);else s.runtime.insertBlock(block,1);
  const inserted=s.runtime.getDocumentMutationIdentity();
  assert.notEqual(inserted,before);
  assert.equal(notifications,0,'text insertion is not a formula semantic notification');
  s.runtime.removeBlock('text');
  assert.notEqual(s.runtime.getDocumentMutationIdentity(),inserted);
  assert.throws(()=>s.history.execute([source('7+9')]),/S95O_HISTORY_DIVERGED/);
});

test('S97a source ABA in another task invalidates document-wide history',()=>{
  const s=fixture();
  s.runtime.addBlock({id:'foreign',type:'formula',taskId:'OTHER',source:'5'});
  const history=createDocumentHistorySession({runtime:s.runtime,getCurrentRevision:s.getCurrentRevision,
    advanceRevision:s.advanceRevision});
  const initial=s.runtime.getDocumentMutationIdentity();
  s.runtime.setBlockSource('foreign','6');s.runtime.setBlockSource('foreign','5');
  assert.notEqual(s.runtime.getDocumentMutationIdentity(),initial);
  assert.throws(()=>history.execute([source('7+9')]),/S95O_HISTORY_DIVERGED/);
  assert.equal(s.epoch,0);
});

test('S97a a move changes document stamp but preserves source identity',()=>{
  const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity();
  const identity=s.runtime.getBlockSourceIdentity('r'),generation=s.runtime.getBlock('r').calculation.generation;
  s.runtime.moveBlock('r',1);
  assert.notEqual(s.runtime.getDocumentMutationIdentity(),stamp);
  assert.equal(s.runtime.getBlockSourceIdentity('r'),identity);
  assert.equal(s.runtime.getBlock('r').calculation.generation,generation);
  assert.equal(s.epoch,0);
});

test('S97a preparation, rejected inputs and real no-ops preserve stamp and redo',()=>{
  const s=fixture();s.history.execute([source('7+9')]);s.history.undo();
  const stamp=s.runtime.getDocumentMutationIdentity(),cursor=s.history.snapshot(),epoch=s.epoch;
  s.runtime.prepareBlock({id:'prepared',type:'text',source:'not published'});
  s.runtime.prepareDocumentTransaction([source('8+9')]);
  for(const reject of [
    ()=>s.runtime.addBlock({id:'r',type:'text'}),
    ()=>s.runtime.insertBlock({id:'x',type:'text'},-1),
    ()=>s.runtime.removeBlock('missing'),
    ()=>s.runtime.moveBlock('r',99),
    ()=>s.runtime.setBlockSource('r',null),
    ()=>s.runtime.prepareDocumentTransaction([remove('missing')]),
  ])assert.throws(reject);
  s.runtime.moveBlock('r',0);
  assert.equal(s.apply([source('1+2'),move(0)]).kind,'unchanged');
  assert.equal(s.history.execute([source('1+2')]).kind,'unchanged');
  assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
  assert.equal(s.epoch,epoch);assert.deepEqual(s.history.snapshot(),cursor);
  assert.equal(s.history.redo().kind,'applied');
});

for(const route of ['direct','transaction'])test('S97a full '+route+' rollback restores token and does not stale an earlier plan',()=>{
  const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity();
  const sourceIdentity=s.runtime.getBlockSourceIdentity('r');
  const pending=s.runtime.prepareDocumentTransaction([source('8+9')]);
  const derive=s.runtime.deriveSemanticTask;let calls=0;
  s.runtime.deriveSemanticTask=function(...args){if(++calls===2)throw new Error('ROLLBACK');return derive.apply(this,args);};
  try {
    assert.throws(()=>route==='direct'?s.runtime.setBlockSource('r','99'):s.apply([source('99')]),/ROLLBACK/);
  } finally{s.runtime.deriveSemanticTask=derive;}
  assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
  assert.equal(s.runtime.getBlockSourceIdentity('r'),sourceIdentity);
  assert.equal(s.runtime.getBlock('r').source,'1+2');
  assert.equal(s.runtime.applyDocumentTransaction(pending).kind,'applied');
});

for(const method of ['add','insert','remove','move']) {
  test('S97a '+method+' failure before authority changes preserves stamp',()=>{
    const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity(),before=s.document();
    const target=method==='add'?'rebuildDependencyAnalysis':'captureSemanticAnalyses';
    // addBlock mutates before rebuilding; use input validation for its pre-write failure.
    if(method==='add')assert.throws(()=>s.runtime.addBlock({id:'r',type:'text'}));
    else{
      const saved=s.runtime[target];s.runtime[target]=()=>{throw new Error('BEFORE');};
      try {
        assert.throws(()=>method==='insert'?s.runtime.insertBlock({id:'text',type:'text'},0):
          method==='remove'?s.runtime.removeBlock('r'):s.runtime.moveBlock('r',1),/BEFORE/);
      } finally{s.runtime[target]=saved;}
    }
    assert.deepEqual(s.document(),before);assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
    assert.equal(s.history.execute([source('7+9')]).kind,'applied');
  });
  test('S97a '+method+' rebuild failure after authority changes leaves a fresh stamp',()=>{
    const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity();
    const plan=s.runtime.prepareDocumentTransaction([source('7+9')]);
    const originalBlocks=[...s.runtime.blocks],originalContent=s.document();
    const rebuild=s.runtime.rebuildDependencyAnalysis;
    s.runtime.rebuildDependencyAnalysis=()=>{throw new Error('AFTER');};
    try {
      assert.throws(()=>method==='add'?s.runtime.addBlock({id:'text',type:'text'}):
        method==='insert'?s.runtime.insertBlock({id:'text',type:'text'},0):
        method==='remove'?s.runtime.removeBlock('r'):s.runtime.moveBlock('r',1),/AFTER/);
    } finally{s.runtime.rebuildDependencyAnalysis=rebuild;}
    assert.notEqual(s.runtime.getDocumentMutationIdentity(),stamp);
    // Restore content through supported APIs after S97c closes raw write access.
    if(method==='add'||method==='insert')s.runtime.removeBlock('text');
    else if(method==='remove')s.runtime.insertBlock({id:'r',type:'formula',taskId:'T',source:'1+2'},0);
    else s.runtime.moveBlock('r',0);
    assert.deepEqual(s.document(),originalContent);
    assert.throws(()=>s.history.execute([source('8+9')]),/S95O_HISTORY_DIVERGED/);
    assert.throws(()=>s.runtime.applyDocumentTransaction(plan),/S95N_STALE_PLAN/);
  });
}

test('S97a calculation publication and invalidation do not change document stamp',async()=>{
  const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity();
  await s.runtime.evaluateAndCommitSemanticTask('T',{revision:s.getCurrentRevision(),
    getCurrentRevision:s.getCurrentRevision,evaluate:async task=>({blockId:task.blockId,status:'success',
      value:expression({op:'integer',value:'9'})})});
  s.runtime.markBlockDirty('r');s.advanceRevision();
  assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
  assert.equal(s.history.execute([source('7+9')]).kind,'applied');
});

test('S97a/S97c rejects visible raw edits before they can bypass the content guard',()=>{
  const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity();
  assert.throws(()=>{s.runtime.getBlock('r').source='99';},/S97C_READ_ONLY/);
  assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
  assert.equal(s.history.execute([source('7+9')]).kind,'applied');
});

test('S97a source/compound applied net-zero publications never reuse earlier stamps',()=>{
  const s=fixture(),seen=new Set([s.runtime.getDocumentMutationIdentity()]);
  for(const ops of [[source('99'),source('1+2')],[move(1),move(0)],
    [insert('tmp'),remove('tmp')]]){
    assert.equal(s.apply(ops).kind,'applied');
    const stamp=s.runtime.getDocumentMutationIdentity();assert.ok(!seen.has(stamp));seen.add(stamp);
  }
});
