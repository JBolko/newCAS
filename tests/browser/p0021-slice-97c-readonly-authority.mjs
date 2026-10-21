/** Test-only S97c acceptance using the production supervised Pyodide Worker. */
import {diagnostic} from '../../src/js/diagnostics/diagnostic.js';
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
const runtime=DocumentRuntime.createSemantic('s97c-browser');
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
 const view=runtime.getBlock('r'),snapshot=runtime.getBlocks(),stamp=runtime.getDocumentMutationIdentity();
 const reject=fn=>{let rejected=false;try{fn();}catch(error){rejected=error instanceof TypeError;}check(rejected,'mutation rejected');};
 for(const write of [()=>runtime.blocks.pop(),()=>{runtime.blocks=[];},()=>{view.source='forged';},
  ()=>{view.calculation.status='success';},()=>view.dependencies.reads.push('forged'),
  ()=>{snapshot[0].taskId='foreign';},()=>Object.defineProperty(view,'source',{value:'forged'}),
  ()=>{Object.getOwnPropertyDescriptor(view,'calculation').value.generation=999;},
  ()=>runtime.dependencyAnalysis.clear(),()=>runtime.getDependencyGraph('T').nodes.clear(),
  ()=>Object.defineProperty(runtime,'blocks',{value:[]})])reject(write);
 check(runtime.getDocumentMutationIdentity()===stamp&&view.source==='a:=1+2','no authority mutation');
 results.push('PASS: browser array/block/nested/reflection/graph writes cannot reach authority');
 const historyBefore=JSON.stringify(history.snapshot()),epochBefore=epoch;
 for(const extra of [Object.freeze(new Map()),Object.freeze(new Set()),Object.freeze(new Date(0)),()=>null]) {
  const supplied=Object.freeze({...diagnostic('S97C4'),extra});
  const token=runtime.getDocumentMutationIdentity();
  reject(()=>runtime.addBlock({id:'forbidden',type:'text',source:'text',metadata:{supplied}}));
  check(runtime.getBlock('forbidden')===null,'invalid envelope not admitted');
  check(runtime.getDocumentMutationIdentity()===token,'rejection consumes no mutation stamp');
 }
 check(JSON.stringify(history.snapshot())===historyBefore&&epoch===epochBefore,'rejection preserves history/revision');
 results.push('PASS: S97c.4 rejects frozen exotic Diagnostic input atomically before actual Worker/history actions');

 edit.begin('r');edit.replaceSource('a:=7+9');const pendingEnter=enter();
 check(edit.snapshot()===null,'early draft release');check(runtime.getBlock('r')===view,'stable incarnation across history source');
 check((await pendingEnter).kind==='complete','real Worker result');
 check(view.calculation.result.data.expr.value==='16','held view reads actual SymPy 16');
 const result=view.calculation.result;reject(()=>{result.data.expr.value='999';});
 check(view.calculation.result===result&&Object.isFrozen(result),'Value identity immutable');
 results.push('PASS: live view receives real Pyodide/SymPy result and preserves immutable Value identity');
 const firstSource=runtime.getBlockSourceIdentity('r');history.undo();
 check(runtime.getBlock('r')===view,'Undo source keeps incarnation');await session.run();
 check(view.calculation.result.data.expr.value==='3','actual Undo value 3');history.redo();await session.run();
 check(view.calculation.result.data.expr.value==='16','actual Redo value 16');
 check(runtime.getBlockSourceIdentity('r')!==firstSource,'fresh source token');
 history.execute([{kind:'remove',blockId:'r'}]);history.undo();const replacement=runtime.getBlock('r');
 check(replacement!==view&&replacement.id===view.id,'Undo delete original ID fresh view');
 await session.run();check(replacement.calculation.result.data.expr.value==='16','Undo delete actual result');
 reject(()=>{view.source='old view write';});
 results.push('PASS: actual Undo/Redo and Undo-delete keep source tokens distinct and incarnations fresh');
 const held=holdResult();edit.begin('r');edit.replaceSource('a:=8+9');const pending=enter();await held.ready;
 reject(()=>{replacement.calculation.result='forged';});
 runtime.setBlockSource('r','a:=100');runtime.setBlockSource('r','a:=8+9');
 held.release();check((await pending).kind==='stale','actual delayed Worker after source ABA stale');
 check(replacement.calculation.result===null,'stale value never publishes');
 await session.run();check(replacement.calculation.result.data.expr.value==='17','held recreated view reads fresh actual result');
 results.push('PASS: raw mutation blocked while actual Worker waits; supported source ABA rejects stale publication');
 window.s97cResult={pass:results.length,fail:0,todo:0,skip:0,results};
} catch(error) {
 window.s97cResult={pass:results.length,fail:1,todo:0,skip:0,results,error:String(error.stack??error)};
} finally {
 session.close();document.getElementById('result').textContent=JSON.stringify(window.s97cResult,null,2);
}
