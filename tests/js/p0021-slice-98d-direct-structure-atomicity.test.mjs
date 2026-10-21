/** F1b: direct structural writes must share existing atomic runtime publication. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {structuralFixture,structuralEdits,structuralState} from '../helpers/structural-mutation-fixture.mjs';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';
import {expression} from '../../src/js/values/value.js';

for(const legacy of [false,true])for(const kind of Object.keys(structuralEdits))
for(const phase of ['rebuild','semantic'])
test(`F1b ${kind} rolls back ${phase} failure after a write; legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy),before=structuralState(rt),stamp=rt.getDocumentMutationIdentity();
  const views=rt.getBlocks(),tokens=views.map(b=>rt.getBlockSourceIdentity(b.id));
  const graph=rt.getDependencyGraph('T'),result=rt.getBlock('b').calculation.result;
  const error=rt.getBlock('c').calculation.error.diagnostic;
  let notices=0,injected=0;
  rt.subscribeSemanticChanges(()=>notices++);
  const method=phase==='rebuild'?'rebuildDependencyAnalysis':'deriveSemanticTask';
  const original=rt[method];
  rt[method]=function(...args){
    const current=this.getBlocks().map(b=>b.id);
    const changed=current.join('|')!==views.map(b=>b.id).join('|');
    if(changed){
      injected++;
      // Also prove rollback of an analysis which has already been replaced.
      if(phase==='rebuild')original.apply(this,args);
      throw Error('S98D_AFTER_STRUCTURE');
    }
    return original.apply(this,args);
  };
  try{assert.throws(()=>structuralEdits[kind](rt),/S98D_AFTER_STRUCTURE/);}
  finally{rt[method]=original;}
  assert.equal(injected,1,'failure must occur after staging authoritative order');
  assert.deepEqual(structuralState(rt),before);assert.equal(rt.getDocumentMutationIdentity(),stamp);
  assert.equal(rt.getDependencyGraph('T'),graph);assert.equal(notices,0);
  for(const [i,view] of views.entries()){
    assert.equal(rt.getBlock(view.id),view);assert.equal(rt.getBlockSourceIdentity(view.id),tokens[i]);
  }
  assert.equal(rt.getBlock('b').calculation.result,result);
  assert.equal(rt.getBlock('c').calculation.error.diagnostic,error);
  structuralEdits[kind](rt);assert.notEqual(rt.getDocumentMutationIdentity(),stamp);
});

for(const legacy of [false,true])for(const kind of ['insert','move','remove'])
test(`F1b ${kind} restores calculation slots after actual downstream dirtying; legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy),before=structuralState(rt),stamp=rt.getDocumentMutationIdentity();
  let injected=0,notices=0;
  rt.subscribeSemanticChanges(()=>notices++);
  const original=rt.markBlockDirty;
  rt.markBlockDirty=function(id){
    original.call(this,id);
    if(id==='f'){
      assert.equal(this.getBlock(id).calculation.status,'dirty');
      assert.equal(this.getBlock(id).calculation.result,null);injected++;
      throw Error('S98D_AFTER_DIRTY');
    }
  };
  try{assert.throws(()=>structuralEdits[kind](rt),/S98D_AFTER_DIRTY/);}
  finally{rt.markBlockDirty=original;}
  assert.equal(injected,1);assert.deepEqual(structuralState(rt),before);
  assert.equal(rt.getDocumentMutationIdentity(),stamp);assert.equal(notices,0);
  assert.equal(rt.getBlock('f').calculation.status,'success');
  structuralEdits[kind](rt);
});

for(const legacy of [false,true])for(const kind of Object.keys(structuralEdits))
test(`F1b text ${kind} rolls back without losing metadata or views; legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy),before=structuralState(rt),view=rt.getBlock('text');
  const stamp=rt.getDocumentMutationIdentity(),rebuild=rt.rebuildDependencyAnalysis;
  const edit=kind==='add'?()=>rt.addBlock({id:'new',type:'text',metadata:{items:[7]}}):
    kind==='insert'?()=>rt.insertBlock({id:'new',type:'text',metadata:{items:[7]}},1):
    kind==='move'?()=>rt.moveBlock('text',0):()=>rt.removeBlock('text');
  rt.rebuildDependencyAnalysis=function(){rebuild.call(this);throw Error('S98D_TEXT');};
  try{assert.throws(edit,/S98D_TEXT/);}finally{rt.rebuildDependencyAnalysis=rebuild;}
  assert.deepEqual(structuralState(rt),before);assert.equal(rt.getBlock('text'),view);
  assert.equal(rt.getDocumentMutationIdentity(),stamp);edit();
});

test('F1b failed direct edit neither diverges history nor stales a prepared plan',async()=>{
  const rt=await structuralFixture(),stamp=rt.getDocumentMutationIdentity();let epoch=0;
  const history=createDocumentHistorySession({runtime:rt,getCurrentRevision:()=>String(epoch),advanceRevision:()=>{epoch++;}});
  const pending=rt.prepareDocumentTransaction([{kind:'source',blockId:'b',source:'b:=8'}]);
  const original=rt.rebuildDependencyAnalysis;rt.rebuildDependencyAnalysis=()=>{throw Error('FAIL');};
  try{assert.throws(()=>rt.removeBlock('a'),/FAIL/);}finally{rt.rebuildDependencyAnalysis=original;}
  assert.equal(rt.getDocumentMutationIdentity(),stamp);assert.equal(epoch,0);
  assert.equal(history.execute([{kind:'move',blockId:'a',index:0}]).kind,'unchanged');
  assert.equal(rt.applyDocumentTransaction(pending).kind,'applied');
  assert.throws(()=>history.undo(),/S95O_HISTORY_DIVERGED/,'actual foreign success still diverges');
});

test('F1b failed host action restores runtime, while monotonic host revision remains advanced',async()=>{
  const rt=await structuralFixture(),before=structuralState(rt),stamp=rt.getDocumentMutationIdentity();let epoch=0;
  const action=createFormulaStructuralAction({runtime:rt,taskId:'T',getCurrentRevision:()=>String(epoch),advanceRevision:()=>{epoch++;}});
  const original=rt.rebuildDependencyAnalysis;rt.rebuildDependencyAnalysis=()=>{throw Error('FAIL');};
  try{assert.throws(()=>action.apply({kind:'remove',blockId:'a'}),/FAIL/);}finally{rt.rebuildDependencyAnalysis=original;}
  assert.deepEqual(structuralState(rt),before);assert.equal(rt.getDocumentMutationIdentity(),stamp);assert.equal(epoch,1);
  assert.equal(action.apply({kind:'remove',blockId:'a'}).kind,'applied');assert.equal(epoch,2);
});

for(const legacy of [false,true])for(const kind of Object.keys(structuralEdits))
test(`direct ${kind} keeps affected-set/return and incarnation contracts; legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy),before=structuralState(rt);
  const views=new Map(rt.getBlocks().map(b=>[b.id,b])),tokens=new Map(rt.getBlocks().map(b=>[b.id,rt.getBlockSourceIdentity(b.id)]));
  const stamp=rt.getDocumentMutationIdentity(),notices=[];
  rt.subscribeSemanticChanges(ids=>notices.push([...ids]));
  const result=structuralEdits[kind](rt);
  assert.deepEqual(notices,[['T']]);assert.notEqual(rt.getDocumentMutationIdentity(),stamp);
  if(kind==='add')assert.equal(result,rt.getBlock('new'));
  else assert.deepEqual(result,new Set(['f','b','c']),'inserted/removed IDs are not invalidated survivors');
  for(const [id,view] of views)if(rt.getBlock(id)){
    assert.equal(rt.getBlock(id),view);assert.equal(rt.getBlockSourceIdentity(id),tokens.get(id));
  }
  assert.deepEqual(structuralState(rt).blocks.filter(b=>b.taskId==='U'),before.blocks.filter(b=>b.taskId==='U'));
  if(kind==='add'||kind==='insert'){
    const block=rt.getBlock('new');assert.equal(block.calculation.status,'idle');
    assert.equal(block.calculation.generation,0);assert.deepEqual(block.metadata.items,[3]);
    assert.throws(()=>block.metadata.items.push(4),TypeError);
  }
  if(kind==='remove'){
    rt.insertBlock({id:'a',type:'formula',taskId:'T',source:'a:=2'},0);
    assert.notEqual(rt.getBlock('a'),views.get('a'));assert.notEqual(rt.getBlockSourceIdentity('a'),tokens.get('a'));
  }
});

test('failed inserted incarnation is not revived by later same-ID insertion',async()=>{
  const rt=await structuralFixture(),original=rt.rebuildDependencyAnalysis;
  let escaped,token;
  rt.rebuildDependencyAnalysis=function(){
    original.call(this);escaped=this.getBlock('new');token=this.getBlockSourceIdentity('new');
    throw Error('ESCAPED_STAGING');
  };
  try{assert.throws(()=>structuralEdits.insert(rt),/ESCAPED_STAGING/);}finally{rt.rebuildDependencyAnalysis=original;}
  assert.equal(rt.getBlock('new'),null);structuralEdits.insert(rt);
  assert.notEqual(rt.getBlock('new'),escaped);assert.notEqual(rt.getBlockSourceIdentity('new'),token);
});

for(const kind of ['failed-remove','noop-move',...Object.keys(structuralEdits)])
test(`async result freshness follows actual accepted authority, not failed attempts: ${kind}`,async()=>{
  const rt=await structuralFixture();let release,started;
  const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  const stamp=rt.getDocumentMutationIdentity();
  const pending=rt.evaluateAndCommitSemanticTask('T',{revision:'same-epoch',getCurrentRevision:()=> 'same-epoch',
    evaluate:async task=>{started();await gate;return {blockId:task.blockId,status:'success',value:expression({op:'integer',value:'13'})};}});
  await ready;
  try{
    if(kind==='failed-remove'){
      const original=rt.rebuildDependencyAnalysis;rt.rebuildDependencyAnalysis=()=>{throw Error('ROLLBACK');};
      try{assert.throws(()=>rt.removeBlock('a'),/ROLLBACK/);}finally{rt.rebuildDependencyAnalysis=original;}
      assert.equal(rt.getDocumentMutationIdentity(),stamp);
    }else if(kind==='noop-move'){
      assert.deepEqual(rt.moveBlock('a',0),new Set());assert.equal(rt.getDocumentMutationIdentity(),stamp);
    }else structuralEdits[kind](rt);
  }finally{release();}
  const outcome=await pending;
  const accepted=kind!=='failed-remove'&&kind!=='noop-move';
  assert.equal(outcome.kind,accepted?'stale':'complete');
  if(!accepted)assert.equal(rt.getBlock('b').calculation.result.data.expr.value,'13');
  else assert.notEqual(rt.getBlock('b').calculation.result?.data?.expr?.value,'13');
});
