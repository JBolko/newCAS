/** Test-only S97a acceptance using the production supervised Pyodide Worker. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';

const results=[];
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const runtime=DocumentRuntime.createSemantic('s97a-browser');
runtime.addBlock({id:'r',type:'formula',taskId:'T',source:'a:=1+2'});
let epoch=0, delay=null;
const revision=()=>String(epoch);
const advanceRevision=()=>{epoch++;};
const edit=createFormulaEditingSession({runtime,taskId:'T'});
const history=createDocumentHistorySession({runtime,editingSession:edit,
  getCurrentRevision:revision,advanceRevision});
const specs=new Map([['add',operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]]);
const session=createSupervisedSemanticTaskSession({runtime,taskId:'T',
  createWorker:()=>new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'}),
  supervision:{timeoutMs:180000,maxPending:1},getCurrentRevision:revision,advanceRevision,
  createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
    createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,
      evaluate:async(...args)=>{
        const value=await evaluateSelected(...args); // Real SymPy result, never synthesized.
        if(delay){const current=delay;current.arrived();await current.gate;}
        return value;
      }}),
});
const action=createSemanticCalculateAction({runtime,session,taskId:'T',
  getCurrentRevision:revision,advanceRevision,commitOperations:ops=>history.execute(ops)});
const enter=()=>submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){}},
  editingSession:edit,calculateAction:action});
function holdResult(){
  let release,arrived;
  const gate=new Promise(r=>{release=r;});
  const ready=new Promise(r=>{arrived=r;});
  delay={gate,arrived};
  return {ready,release:()=>{delay=null;release();}};
}
try {
  edit.begin('r');edit.replaceSource('a:=7+9');
  const first=enter();
  check(edit.snapshot()===null,'accepted history Enter closes immediately');
  check((await first).kind==='complete','actual Worker completion');
  check(runtime.getBlock('r').calculation.result?.data.expr.value==='16','actual SymPy value 16');
  const documentStamp=runtime.getDocumentMutationIdentity();
  const sourceStamp=runtime.getBlockSourceIdentity('r');
  check(typeof documentStamp==='symbol' && documentStamp!==sourceStamp,'independent opaque identities');
  results.push('PASS: history Enter and actual SymPy publication preserve distinct mutation/source identities');

  const held=holdResult();
  edit.begin('r');edit.replaceSource('a:=8+9');
  const pending=enter();
  await held.ready; // Actual Worker value 17 has returned, but publication remains delayed.
  const acceptedStamp=runtime.getDocumentMutationIdentity();
  const sourceIdentity=runtime.getBlockSourceIdentity('r');
  runtime.setBlockSource('r','a:=100');runtime.setBlockSource('r','a:=8+9');
  check(runtime.getDocumentMutationIdentity()!==acceptedStamp,'foreign ABA changes document stamp');
  check(runtime.getBlockSourceIdentity('r')!==sourceIdentity,'foreign ABA changes source identity');
  const beforeHistory=JSON.stringify(history.snapshot()),beforeEpoch=epoch;
  let rejected=false;
  try{history.undo();}catch(error){rejected=error.message==='S95O_HISTORY_DIVERGED';}
  check(rejected,'history rejects foreign ABA');
  check(epoch===beforeEpoch && JSON.stringify(history.snapshot())===beforeHistory,'rejection consumes no history epoch/cursor');
  edit.begin('r');edit.replaceSource('newer draft');
  const newer=JSON.stringify(edit.snapshot());
  held.release();
  check((await pending).kind==='stale','actual delayed Worker result is stale after ABA');
  check(runtime.getBlock('r').calculation.result===null,'old actual Worker value never publishes');
  check(JSON.stringify(edit.snapshot())===newer,'newer draft survives old settlement');
  edit.cancel();
  results.push('PASS: actual delayed Worker is discarded after foreign source ABA; history fails closed without consuming epoch');

  // An explicit fresh owner is a test fixture choice, never an automatic history reset.
  const resumed=createDocumentHistorySession({runtime,editingSession:edit,getCurrentRevision:revision,advanceRevision});
  resumed.execute([{kind:'source',blockId:'r',source:'a:=7+9'}]);
  const beforeCalculation=runtime.getDocumentMutationIdentity();
  check((await session.run()).kind==='complete','actual reevaluation completes');
  check(runtime.getDocumentMutationIdentity()===beforeCalculation,'actual calculation is not an edit');
  resumed.undo();check((await session.run()).kind==='complete','Undo reevaluates through actual Worker');
  check(runtime.getBlock('r').calculation.result?.data.expr.value==='17','actual Undo result 17');
  resumed.redo();check((await session.run()).kind==='complete','Redo reevaluates through actual Worker');
  check(runtime.getBlock('r').calculation.result?.data.expr.value==='16','actual Redo result 16');
  results.push('PASS: actual recalculation does not diverge history; Undo/Redo retain fresh host epochs');

  const sameIndex=runtime.getBlocks().findIndex(b=>b.id==='r');
  const prepared=runtime.prepareDocumentTransaction([{kind:'source',blockId:'r',source:'a:=9+9'}]);
  const stampBeforeStructure=runtime.getDocumentMutationIdentity(),sourceBeforeStructure=runtime.getBlockSourceIdentity('r');
  runtime.insertBlock({id:'temporary-text',type:'text',source:'paragraph'},sameIndex);
  runtime.removeBlock('temporary-text');
  check(runtime.getDocumentMutationIdentity()!==stampBeforeStructure,'text insert/remove chronology retained');
  check(runtime.getBlockSourceIdentity('r')===sourceBeforeStructure,'text structure does not replace formula source');
  let stale=false;
  try{runtime.applyDocumentTransaction(prepared);}catch(error){stale=error.message==='S95N_STALE_PLAN';}
  check(stale && runtime.getBlock('r').source==='a:=7+9','prepared edit rejected after structural ABA');
  let diverged=false;
  try{resumed.undo();}catch(error){diverged=error.message==='S95O_HISTORY_DIVERGED';}
  check(diverged,'history rejects structural ABA');
  results.push('PASS: text structural ABA invalidates history and prepared plan independently of formula source identity');
  window.s97aResult={pass:4,fail:0,todo:0,skip:0,results};
} catch(error) {
  window.s97aResult={pass:results.length,fail:1,todo:0,skip:0,results,error:String(error.stack??error)};
} finally {
  session.close();
  document.getElementById('result').textContent=JSON.stringify(window.s97aResult,null,2);
}
