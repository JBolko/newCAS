import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
function setup() {
 const runtime=DocumentRuntime.createSemantic('s95o');
 for (const [id,source] of [['a','a:=2'],['f','f(t):=t^2+a'],['r','f(3)']])
   runtime.addBlock({id,source,type:'formula',taskId:'t'});
 let epoch=0;
 const editing=createFormulaEditingSession({runtime,taskId:'t'});
 const history=createDocumentHistorySession({runtime,editingSession:editing,
   getCurrentRevision:()=>`epoch-${epoch}`,advanceRevision:()=>{epoch++;}});
 return {runtime,editing,history,get epoch(){return epoch;},
   document:()=>runtime.getBlocks().map(({id,source})=>[id,source])};
}
test('95o Undo/Redo source edits, monotonic host epoch, no result restore',()=>{
 const s=setup(), before=s.document();
 s.history.execute([{kind:'source',blockId:'a',source:'a:=5'}]);
 assert.equal(s.epoch,1);assert.equal(s.runtime.getBlock('a').source,'a:=5');
 assert.equal(s.history.undo().kind,'applied');assert.deepEqual(s.document(),before);
 assert.equal(s.epoch,2);assert.equal(s.runtime.getBlock('a').calculation.result,null);
 assert.equal(s.history.redo().kind,'applied');assert.equal(s.epoch,3);
 assert.equal(s.runtime.getBlock('a').source,'a:=5');
 assert.deepEqual(s.history.snapshot(),{canUndo:true,canRedo:false,cursor:1,length:1});
});
test('95o Undo removal restores original block ID/order and redo removes it',()=>{
 const s=setup();s.history.execute([{kind:'remove',blockId:'f'}]);
 assert.deepEqual(s.document().map(x=>x[0]),['a','r']);
 s.history.undo();assert.deepEqual(s.document().map(x=>x[0]),['a','f','r']);
 s.history.redo();assert.deepEqual(s.document().map(x=>x[0]),['a','r']);
});
test('95o Undo move preserves stable block object and binding order',()=>{
 const s=setup(), block=s.runtime.getBlock('a');
 s.history.execute([{kind:'move',blockId:'a',index:2}]);
 s.history.undo();assert.equal(s.runtime.getBlock('a'),block);
 assert.deepEqual(s.document().map(x=>x[0]),['a','f','r']);
});
test('95o compound transaction undone in one user action',()=>{
 const s=setup(),initial=s.document();
 s.history.execute([{kind:'insert',blockId:'boost',index:1,taskId:'t',source:'a:=9'},
   {kind:'source',blockId:'a',source:'a:=7'},
   {kind:'move',blockId:'r',index:0}]);
 assert.equal(s.history.snapshot().length,1);
 s.history.undo();assert.deepEqual(s.document(),initial);
 s.history.redo();assert.equal(s.runtime.getBlock('boost').source,'a:=9');
});
test('95o edit after undo truncates redo branch',()=>{
 const s=setup();
 s.history.execute([{kind:'source',blockId:'a',source:'a:=3'}]);
 s.history.execute([{kind:'source',blockId:'a',source:'a:=4'}]);
 s.history.undo();
 s.history.execute([{kind:'source',blockId:'a',source:'a:=8'}]);
 assert.equal(s.history.snapshot().canRedo,false);
 assert.equal(s.history.snapshot().length,2);
 assert.equal(s.history.redo().kind,'unavailable');
 s.history.undo();assert.equal(s.runtime.getBlock('a').source,'a:=3');
});
test('95o rejects active uncommitted EditingSession draft',()=>{
 const s=setup(), before=s.document();
 s.editing.begin('a');s.editing.replaceSource('a:=');
 assert.throws(()=>s.history.execute([{kind:'remove',blockId:'a'}]),/S95O_ACTIVE_DRAFT/);
 assert.deepEqual(s.document(),before);assert.equal(s.epoch,0);
 s.editing.cancel();s.history.execute([{kind:'remove',blockId:'a'}]);
 s.editing.begin('f');assert.throws(()=>s.history.undo(),/S95O_ACTIVE_DRAFT/);
 s.editing.cancel();s.history.undo();assert.deepEqual(s.document(),before);
});
test('95o invalid transaction does not consume history or revision',()=>{
 const s=setup(), before=s.document();
 assert.throws(()=>s.history.execute([
   {kind:'source',blockId:'a',source:'a:=5'},
   {kind:'remove',blockId:'missing'}]),/S95N_REMOVE_INVALID/);
 assert.deepEqual(s.document(),before);assert.equal(s.epoch,0);
 assert.equal(s.history.snapshot().length,0);
});
test('95o no-ops do not advance epoch or truncate redo',()=>{
 const s=setup();s.history.execute([{kind:'source',blockId:'a',source:'a:=3'}]);s.history.undo();
 assert.equal(s.history.execute([{kind:'move',blockId:'a',index:0}]).kind,'unchanged');
 assert.equal(s.epoch,2);assert.equal(s.history.snapshot().canRedo,true);
});
test('95o external authoritative mutation fails closed, not silently mixed with history',()=>{
 const s=setup();s.history.execute([{kind:'source',blockId:'a',source:'a:=5'}]);
 s.runtime.setBlockSource('a','a:=100');
 assert.throws(()=>s.history.undo(),/S95O_HISTORY_DIVERGED/);
 assert.equal(s.runtime.getBlock('a').source,'a:=100');
});
test('95o revision callback cannot mutate authoritative source under plan guard',()=>{
 const s=setup();let epoch=0;
 const x=createDocumentHistorySession({runtime:s.runtime,getCurrentRevision:()=>`r${epoch}`,
   advanceRevision:()=>{epoch++;s.runtime.setBlockSource('a','a:=88');}});
 assert.throws(()=>x.execute([{kind:'source',blockId:'a',source:'a:=5'}]),/S95N_STALE_PLAN/);
 assert.equal(s.runtime.getBlock('a').source,'a:=88');
 assert.equal(x.snapshot().length,0);
});
test('95o empty undo/redo do not change epoch or document',()=>{
 const s=setup();assert.equal(s.history.undo().kind,'unavailable');
 assert.equal(s.history.redo().kind,'unavailable');
 assert.equal(s.epoch,0);
});
test('95o rejected legacy runtime and invalid revision capabilities',()=>{
 const r=new DocumentRuntime({calculate(){}},'legacy');
 assert.throws(()=>createDocumentHistorySession({runtime:r,getCurrentRevision:()=> 'a',advanceRevision:()=>{}}),/S95O_HISTORY_CONTRACT/);
 const s=setup();
 assert.throws(()=>createDocumentHistorySession({runtime:s.runtime,getCurrentRevision:()=> '',advanceRevision:()=>{}}),/S95O_HISTORY_CONTRACT/);
});
