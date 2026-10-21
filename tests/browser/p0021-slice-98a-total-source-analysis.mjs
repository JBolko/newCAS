/** S98a / F1a: canonical source + existing editor actions + actual Pyodide Worker. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';

const results=[], workerCalls=[], sessions=[];
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const value=(runtime,id)=>runtime.getBlock(id).calculation.result?.data?.expr?.value;
const broken=[['bad-assignment','a := 5 -> [m]','Assignment'],
  ['bad-function','f(x) := x+1 -> [m]','FunctionDefinition']];
const specs=new Map([['add',operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]]);
let epoch=0;
const revision=()=>String(epoch),advanceRevision=()=>{epoch++;};

function taskSession(runtime,taskId) {
  const session=createSupervisedSemanticTaskSession({runtime,taskId,
    createWorker:()=>new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'}),
    supervision:{timeoutMs:180000,maxPending:1},getCurrentRevision:revision,advanceRevision,
    createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
      createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,
        evaluate:async(envelope,selection)=>{
          workerCalls.push({documentId:runtime.documentId,taskId,blockId:envelope.blockId});
          return await evaluateSelected(envelope,selection); // Actual result; no synthesized Value.
        }}),
  });
  sessions.push(session);
  return session;
}

function checkUnsupported(runtime,id,source,innerType) {
  const ast=parse(source)[0],block=runtime.getBlock(id);
  check(ast.type==='Conversion' && ast.expr.type===innerType,'exact canonical Conversion AST');
  check(block.source===source,'unsupported source preserved byte-for-byte');
  check(block.calculation.status==='error' && block.calculation.result===null,'no fabricated Value');
  const error=block.calculation.error;
  check(error.code==='unsupported-operation' && isDiagnostic(error.diagnostic),'local P0009 diagnostic');
  check(error.diagnostic.code===error.code && error.diagnostic.parameters.operationId==='conversion','diagnostic parameters');
  const {snapshot,analysis}=runtime.deriveSemanticTask('A');
  const entry=snapshot.blocks.find(b=>b.blockId===id);
  check(entry.parseError===null && entry.references.length===0 && entry.calls.length===0,'no syntax failure or partial bindings');
  check(!snapshot.writers.some(w=>w.writerId===id),'no nested writer');
  check(analysis.graph.getUpstream(id).length===0 && analysis.bindings.get(id).size===0,'no semantic dependencies');
  check(block.dependencies.reads.length===0 && block.dependencies.writes.length===0,'no legacy graph leakage');
  check(!workerCalls.some(c=>c.blockId===id),'unsupported conversion never reaches backend');
}

// Test-only DOM wiring through existing EditingSession and Enter action.
function mountEditor(runtime,taskId,blockId,session) {
  const editing=createFormulaEditingSession({runtime,taskId});
  const action=createSemanticCalculateAction({runtime,session,taskId,getCurrentRevision:revision,advanceRevision});
  const input=document.createElement('input');
  input.id=`edit-${blockId}`; input.setAttribute('aria-label',`${taskId}: ${blockId}`);
  input.value=runtime.getBlock(blockId).source;
  document.getElementById('editors').append(input);
  let pending=null;
  input.addEventListener('input',()=>{
    if(editing.snapshot()===null)editing.begin(blockId);
    editing.replaceSource(input.value);
  });
  input.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    pending=submitFormulaEditorEnter({event,editingSession:editing,calculateAction:action});
    pending.catch(()=>{});
  });
  return {async enter(source) {
    const original=runtime.getBlock(blockId).source;
    input.value=source;input.dispatchEvent(new Event('input',{bubbles:true}));
    check(runtime.getBlock(blockId).source===original,'typing remains draft-only');
    pending=null;
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    check(pending!==null,'DOM Enter dispatched existing action');
    const result=await pending;
    check(result.kind==='complete' && editing.snapshot()===null,'Enter completes and releases draft');
    check(runtime.getBlock(blockId).source===source,'Enter preserves accepted source');
  }};
}

const runtime=DocumentRuntime.createSemantic('s98a-browser');
const add=(id,source,taskId='A')=>runtime.addBlock({id,type:'formula',taskId,source});
try {
  add('provider','a:=2+3');add('function','f(x):=x+1');
  for(const [id,source] of broken)add(id,source);
  add('use','b:=a+1');add('call','f(2)');
  add('other','a:=7+9','B');add('other-use','b:=a+1','B');
  const aSession=taskSession(runtime,'A'),bSession=taskSession(runtime,'B');
  const otherEditor=mountEditor(runtime,'B','other',bSession);
  const badEditor=mountEditor(runtime,'A','bad-assignment',aSession);
  check((await aSession.run()).kind==='complete','task A completes despite both F1a sources');
  for(const [id,source,innerType] of broken) {
    checkUnsupported(runtime,id,source,innerType);
    results.push(`PASS: Conversion(${innerType}) preserves source, has no bindings/writer/dependencies and publishes local unsupported-operation without backend dispatch`);
  }
  const {analysis}=runtime.deriveSemanticTask('A');
  check(analysis.bindings.get('use').get('a')==='provider','ordinary writer remains selected');
  check(analysis.bindings.get('call').get('f')==='function','ordinary callable writer remains selected');
  check(value(runtime,'provider')==='5' && value(runtime,'use')==='6' && value(runtime,'call')==='3','actual Worker results after unsupported statements');
  check(['provider','use','call'].every(id=>workerCalls.some(c=>c.blockId===id)),'successful controls actually reached Worker');
  document.getElementById('diagnostics').textContent=JSON.stringify(broken.map(([id])=>({blockId:id,
    diagnostic:runtime.getBlock(id).calculation.error.diagnostic})),null,2);
  results.push('PASS: subsequent valid blocks and original variable/function writers produce real SymPy 5/6/3');

  check((await bSession.run()).kind==='complete','task B initial actual Worker evaluation');
  check(value(runtime,'other')==='16' && value(runtime,'other-use')==='17','task B initial real 16/17');
  const identities=broken.map(([id])=>runtime.getBlockSourceIdentity(id));
  const slots=broken.map(([id])=>runtime.getBlock(id).calculation);
  await otherEditor.enter('a:=8+9');
  check(value(runtime,'other')==='17' && value(runtime,'other-use')==='18','task B DOM Enter computes real 17/18');
  broken.forEach(([id,source,innerType],i)=>{
    checkUnsupported(runtime,id,source,innerType);
    check(runtime.getBlockSourceIdentity(id)===identities[i] && runtime.getBlock(id).calculation===slots[i],'task B did not touch task A source/results');
  });
  const otherIdentity=runtime.getBlockSourceIdentity('other'),otherResult=runtime.getBlock('other-use').calculation.result;
  await badEditor.enter('a := outside+1 -> [m]');
  checkUnsupported(runtime,'bad-assignment','a := outside+1 -> [m]','Assignment');
  check(runtime.getBlockSourceIdentity('other')===otherIdentity && runtime.getBlock('other-use').calculation.result===otherResult,'task A Enter did not touch task B');
  await otherEditor.enter('a:=9+10');
  check(value(runtime,'other')==='19' && value(runtime,'other-use')==='20','task B remains editable after unsupported task A Enter');
  results.push('PASS: real DOM input/Enter edits stay task-isolated in both directions; task B real values 16/17, 17/18 and 19/20');

  // Source-only reconstruction via public APIs, not a persistence implementation.
  const sources=JSON.parse(JSON.stringify(runtime.getBlocks().map(({id,type,taskId,source})=>({id,type,taskId,source}))));
  const restored=DocumentRuntime.createSemantic('s98a-restored');
  for(const block of sources)restored.addBlock(block);
  for(const taskId of ['A','B'])check((await taskSession(restored,taskId).run()).kind==='complete','restored task evaluates');
  checkUnsupported(restored,'bad-assignment','a := outside+1 -> [m]','Assignment');
  checkUnsupported(restored,'bad-function',broken[1][1],'FunctionDefinition');
  check(value(restored,'use')==='6' && value(restored,'call')==='3' && value(restored,'other-use')==='20','restored sources evaluated by real Worker');
  check(restored.getBlocks().every((b,i)=>b.source===sources[i].source),'all reconstructed sources preserved');
  results.push('PASS: source-only public API reconstruction keeps both diagnostics and actual Worker results 6/3/20');
  window.s98aResult={pass:results.length,fail:0,todo:0,skip:0,results,workerCalls};
} catch(error) {
  window.s98aResult={pass:results.length,fail:1,todo:0,skip:0,results,workerCalls,error:String(error.stack??error)};
} finally {
  for(const session of sessions)session.close();
  document.getElementById('result').textContent=JSON.stringify(window.s98aResult,null,2);
}
