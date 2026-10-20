/** Test-only S96b.2 acceptance using the production supervised Pyodide Worker. */
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
const runtime=DocumentRuntime.createSemantic('s96b2-browser');
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
  check(edit.snapshot()===null,'draft must close before Worker settles');
  check(history.snapshot().length===1 && epoch===1,'one source transaction');
  check((await first).kind==='complete','real Worker completion');
  check(runtime.getBlock('r').calculation.status==='success',JSON.stringify(runtime.getBlock('r').calculation));
  check(runtime.getBlock('r').calculation.result.data.expr.value==='16','real SymPy 7+9 = 16');
  results.push('PASS: accepted history Enter releases early and real SymPy returns 16');

  const held=holdResult();
  edit.begin('r');edit.replaceSource('a:=8+9');
  const pending=enter();
  check(edit.snapshot()===null,'second draft closes early');
  await held.ready; // Ensure the real Worker has returned before abandoning this result.
  history.undo();
  check(epoch===3 && runtime.getBlock('r').source==='a:=7+9','Undo advances epoch');
  edit.begin('r');edit.replaceSource('new draft while old evaluation settles');
  const newer=JSON.stringify(edit.snapshot());
  held.release();
  check((await pending).kind==='stale','late real Worker result rejected');
  check(runtime.getBlock('r').calculation.result===null,'abandoned value never published');
  check(JSON.stringify(edit.snapshot())===newer,'newer draft survives late settlement');
  edit.cancel();
  results.push('PASS: Undo rejects delayed real Worker result and preserves newer draft');

  const before=JSON.stringify(history.snapshot()),beforeEpoch=epoch;
  const unchangedHold=holdResult();
  edit.begin('r');
  const unchanged=enter();
  check(edit.snapshot()===null,'unchanged Enter closes early');
  check(JSON.stringify(history.snapshot())===before && epoch===beforeEpoch,'unchanged preserves redo and revision');
  await unchangedHold.ready;unchangedHold.release();
  check((await unchanged).kind==='complete','unchanged real evaluation completes');
  check(runtime.getBlock('r').calculation.result.data.expr.value==='16','unchanged result is 16');
  results.push('PASS: unchanged Enter preserves redo and evaluates with real SymPy');
  window.s96b2Result={pass:3,fail:0,todo:0,skip:0,results};
} catch(error) {
  window.s96b2Result={pass:results.length,fail:1,todo:0,skip:0,results,error:String(error.stack??error)};
} finally {
  session.close();
  document.getElementById('result').textContent=JSON.stringify(window.s96b2Result,null,2);
}
