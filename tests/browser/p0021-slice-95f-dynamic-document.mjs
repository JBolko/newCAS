/**
 * S95f — independent TEST-ONLY, variable-length formula document.
 * Draft DOM inputs are NOT a second authoritative document; only explicit
 * Calculate submits source/structure together through one HistorySession.
 * Uses existing S95e Calculate action and supervised Pyodide/SymPy session.
 */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {renderSemanticCalculation} from '../../src/js/renderer.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {parseS95fTestFixture,validateS95fDrafts,S95F_MAX_BYTES} from './p0021-slice-95f-test-fixture.mjs';
// S97b replaces reconcileS95fDraftStructure's direct structural pre-pass.
const $ = id=>document.getElementById(id);
const DEFAULT = Object.freeze([
  {id:'a',source:'a:=2'}, {id:'f',source:'f(t):=t^2+a'},
  {id:'r3',source:'f(3)'},{id:'r4',source:'f(4)'}]);
const log=$('log'), status=$('status');
const TASK='fixture';
const runtime=DocumentRuntime.createSemantic('s95f-test');
for (const block of DEFAULT) runtime.addBlock({id:block.id,type:'formula',taskId:TASK,source:block.source});
let tick=0, revision=`s95f-${tick}`;
const nextRevision=()=>{revision=`s95f-${++tick}`;};
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
const session=createSupervisedSemanticTaskSession({
  runtime,taskId:TASK,
  createWorker:()=>new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'}),
  supervision:{timeoutMs:180_000,maxPending:1},
  getCurrentRevision:()=>revision,advanceRevision:nextRevision,
  createEvaluate:({snapshot,revision:batchRevision,cachedOutcomes,evaluateSelected})=>
    createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:evaluateSelected,
      revision:batchRevision,cachedOutcomes}),
});
const editing=createFormulaEditingSession({runtime,taskId:TASK});
const history=createDocumentHistorySession({runtime,editingSession:editing,
  getCurrentRevision:()=>revision,advanceRevision:nextRevision});
const commitOperations=operations=>history.execute(operations);
const calculateAction=createSemanticCalculateAction({runtime,session,taskId:TASK,commitOperations,
  getCurrentRevision:()=>revision,advanceRevision:nextRevision});
const structure=createFormulaStructuralAction({runtime,taskId:TASK,editingSession:editing,commitOperations,
  getCurrentRevision:()=>revision,advanceRevision:nextRevision});
const buttons=[$('evaluate'),$('restart'),$('load-fixture'),$('accept-95f'),$('accept-95k'),$('accept-95m'),$('accept-95p')];
const say=s=>{log.textContent+=`${s}\n`;};
const requireResult=(condition,label)=>{if(!condition)throw new Error(label);say(`PASS: ${label}`);};

function renderDrafts(rows) {
  // Fixture replacement discards an uncommitted editor buffer, never model source.
  if (editing.snapshot() && !editing.snapshot().pending) editing.cancel();
  const drafts=validateS95fDrafts(rows); // no DOM mutation until ALL rows validate
  const fragment=document.createDocumentFragment();
  for (const block of drafts) {
    const line=document.createElement('div');line.className='row';line.dataset.blockId=block.id;
    const label=document.createElement('label');label.textContent=block.id;
    const field=document.createElement('input');field.type='text';field.value=block.source;
    field.autocomplete='off';field.setAttribute('aria-label',`Kilde ${block.id}`);
    const output=document.createElement('output');output.textContent='kladde';
    line.append(label,field,output);fragment.appendChild(line);
  }
  $('cells').replaceChildren(fragment);
}
function readDrafts() {
  return validateS95fDrafts([...$('cells').children].map(line=>({
    id:line.dataset.blockId,source:line.querySelector('input').value,
  })));
}
function display() {
  for (const line of $('cells').children) {
    const calc=runtime.getBlock(line.dataset.blockId)?.calculation;
    // S95g: presentation now belongs to the shared renderer used by main.js.
    renderSemanticCalculation(calc,line.querySelector('output'));
  }
}
function displayedValue(id) {
  const line=[...$('cells').children].find(row=>row.dataset.blockId===id);
  return line?.querySelector('output')?.textContent;
}

let uiBusyDepth=0; // Presentation-only: nested acceptance actions must not re-enable inputs.
function setBusy(busy) {
  uiBusyDepth=busy ? uiBusyDepth+1 : Math.max(0,uiBusyDepth-1);
  const disabled=uiBusyDepth>0;
  for(const button of buttons)button.disabled=disabled;
  $('fixture-file').disabled=disabled;
  for(const line of $('cells').children)line.querySelector('input').disabled=disabled;
}
async function action(label,fn) {
  setBusy(true);status.className='pending';status.textContent=label;
  try {await fn();status.className='pass';status.textContent=`PASS — ${label}`;}
  catch(error){status.className='fail';status.textContent=`FAIL — ${label}`;say(`ERROR: ${error?.message??String(error)}`);}
  finally{setBusy(false);}
}
async function run() {
  // The explicit whole-document Calculate action owns its DOM draft proposal;
  // do not leave a stale per-field EditingSession active across this commit.
  if (editing.snapshot() && !editing.snapshot().pending) editing.cancel();
  const drafts=readDrafts();
  const result=await calculateAction.calculate(drafts.map(b=>({blockId:b.id,source:b.source})),
    {reconcileStructure:true});
  display();
  if(result.kind!=='complete')throw new Error(`Batch did not complete: ${result.kind}`);
  for(const draft of drafts) {
    const slot=runtime.getBlock(draft.id)?.calculation;
    if(slot?.status!=='success') {
      const diagnostic=slot?.error?.diagnostic?.code??slot?.error?.code??slot?.status??'UNKNOWN';
      throw new Error(`S95F_CALCULATION_FAILED: ${draft.id}: ${diagnostic}`);
    }
  }
  return result;
}
// S95k: keyboard is only an INPUT EVENT; S95i owns the single active buffer.
// Block/task IDs come from the authoritative runtime, never from DOM counts.
function beginEditor(blockId) {
  const active=editing.snapshot();
  if (active?.blockId===blockId) return;
  if (active) editing.cancel(); // Rejects a still-pending submission.
  editing.begin(blockId);
}
let lastEnterPromise=Promise.resolve();
$('cells').addEventListener('focusin',event=>{
  if (!event.target.matches('input[type=text]')) return;
  try {beginEditor(event.target.closest('.row').dataset.blockId);}
  catch (error) {say(`EDITOR: ${error?.message??String(error)}`);}
});
$('cells').addEventListener('input',event=>{
  if (!event.target.matches('input[type=text]')) return;
  try {
    beginEditor(event.target.closest('.row').dataset.blockId);
    editing.replaceSource(event.target.value);
  } catch (error) {say(`EDITOR: ${error?.message??String(error)}`);}
});
$('cells').addEventListener('keydown',event=>{
  if (!event.target.matches('input[type=text]') || event.key!=='Enter' ||
      event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ||
      event.repeat || event.isComposing || event.keyCode===229) return;
  event.preventDefault();
  try {
    beginEditor(event.target.closest('.row').dataset.blockId);
    editing.replaceSource(event.target.value);
    lastEnterPromise=action('Enter: EditingSession → Beregn',async()=>{
      const outcome=await submitFormulaEditorEnter({event,editingSession:editing,
        calculateAction});
      display();
      return outcome;
    });
  } catch (error) {
    status.className='fail';status.textContent='FAIL — Enter';
    say(`ENTER: ${error?.message??String(error)}`);
    lastEnterPromise=Promise.reject(error);
    lastEnterPromise.catch(()=>{});
  }
});
renderDrafts(DEFAULT);
$('evaluate').addEventListener('click',()=>action('Beregning via eksisterende IR/Pyodide',run));
$('restart').addEventListener('click',()=>action('Eksplicit Worker-genstart',()=>{
  session.restart();say('Worker udskiftet uden implicit genberegning.');
}));
$('load-fixture').addEventListener('click',()=>action('Fil indlæst som kladde',async()=>{
  const file=$('fixture-file').files?.[0];
  if(!file)throw new Error('Vælg først en JSON-fil.');
  if(file.size>S95F_MAX_BYTES)throw new Error('S95F_FIXTURE_SIZE');
  renderDrafts(parseS95fTestFixture(await file.text()));
  say('Kilderne er kun kladder. Beregn for at ændre DocumentRuntime.');
}));
$('accept-95f').addEventListener('click',()=>action('S95f variable blokke + rigtig Pyodide',async()=>{
  log.textContent='';
  renderDrafts(DEFAULT);
  await run();
  requireResult(runtime.getBlock('r3').calculation.result?.data?.expr?.value==='11' &&
    runtime.getBlock('r4').calculation.result?.data?.expr?.value==='18',
    'Fire blokke beregnes med faktisk Pyodide: f(3)=11 og f(4)=18');
  requireResult(displayedValue('r3')==='= 11' && displayedValue('r4')==='= 18',
    'Eksisterende renderer viser de udvalgte Value-resultater uden legacy-adapter');
  const oldRev=revision;
  const response=await fetch('./fixtures/p0021-slice-95f-five-formulas.json',{cache:'no-store'});
  if(!response.ok)throw new Error(`Fixture HTTP ${response.status}`);
  renderDrafts(parseS95fTestFixture(await response.text()));
  requireResult(runtime.getBlocks().length===4 && runtime.getBlock('a').source==='a:=2' && revision===oldRev,
    'Indlæsning af fem blokke ændrer kun kladder; dokumentet forbliver fire blokke');
  await run();
  requireResult(runtime.getBlocks().length===5 &&
    runtime.getBlocks().map(b=>b.id).join(',')==='a,f,r3,r4,r5',
    'Eksplicit Beregn indsætter femte blok via eksisterende DocumentRuntime');
  requireResult(runtime.getBlock('r3').calculation.result?.data?.expr?.value==='14' &&
    runtime.getBlock('r4').calculation.result?.data?.expr?.value==='21' &&
    runtime.getBlock('r5').calculation.result?.data?.expr?.value==='30',
    'Fem blokke beregnes korrekt med faktisk Pyodide: 14, 21 og 30');
  requireResult(displayedValue('r3')==='= 14' && displayedValue('r4')==='= 21' && displayedValue('r5')==='= 30',
    'Fem Value-resultater præsenteres af samme renderer');
  renderDrafts([{id:'a',source:'a:=5'}, {id:'f',source:'f(t):=t^2+a'}, {id:'r3',source:'f(3)'}]);
  requireResult(runtime.getBlocks().length===5, 'Fjernelse i kladden ændrer ikke autoritativt dokument');
  await run();
  requireResult(runtime.getBlocks().length===3 && !runtime.getBlock('r5') &&
    runtime.getBlock('r3').calculation.result?.data?.expr?.value==='14',
    'Eksplicit Beregn fjerner to blokke og bevarer korrekt resultat');
  noteDone();
}));
$('accept-95k').addEventListener('click',()=>action('S95k Enter + EditingSession + rigtig Pyodide',async()=>{
  log.textContent='';
  renderDrafts(DEFAULT);
  await run();
  const before=revision;
  const input=$('cells').querySelector('.row[data-block-id="a"] input');
  input.focus();
  input.value='a:=';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  requireResult(runtime.getBlock('a').source==='a:=2' && revision===before &&
    editing.snapshot()?.source==='a:=',
    'Ufuldstændig tastning forbliver EditingSession-kladde uden dokumentmutation');
  input.value='a:=5';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  const key=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  input.dispatchEvent(key);
  await lastEnterPromise;
  requireResult(key.defaultPrevented && runtime.getBlock('a').source==='a:=5' &&
    editing.snapshot()===null && runtime.getBlocks().length===4,
    'Enter overfører én kladde med stabilt blok-id via eksisterende Calculate');
  requireResult(runtime.getBlock('r3').calculation.result?.data?.expr?.value==='14' &&
    runtime.getBlock('r4').calculation.result?.data?.expr?.value==='21' &&
    displayedValue('r3')==='= 14' && displayedValue('r4')==='= 21',
    'Enter invaliderer afhængigheder og beregner 14/21 med rigtig Pyodide og renderer');
  input.focus();input.value='a:=99';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  const modified=new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true});
  input.dispatchEvent(modified);
  requireResult(!modified.defaultPrevented && runtime.getBlock('a').source==='a:=5',
    'Ctrl+Enter udfører ikke en autoritativ beregning');
  // Leave the test UI in a coherent, editable state.
  if(editing.snapshot() && !editing.snapshot().pending) editing.cancel();
  input.value='a:=5';
  say('S95k: Tastaturkobling i TEST-UI, ikke endelig elev-UI eller .ncas.');
}));

// S95m: REAL browser proof of one-operation structural edits. The existing
// DocumentRuntime, S95e Calculate, EditingSession and Pyodide Worker are reused.
// This is not undo/redo, a structural transaction or a second document state.
$('accept-95m').addEventListener('click',()=>action('S95m strukturelle handlinger + rigtig Pyodide',async()=>{
  log.textContent='';
  renderDrafts(DEFAULT);
  await run();
  requireResult(displayedValue('r3')==='= 11' && displayedValue('r4')==='= 18',
    'Grunddokumentet er beregnet med faktisk Pyodide');

  const before=revision;
  const inserted=structure.apply({kind:'insert',blockId:'boost',index:1,source:'a:=5'});
  requireResult(inserted.kind==='applied' && runtime.getBlock('boost')?.source==='a:=5' &&
    revision!==before && runtime.getBlocks().map(b=>b.id).join(',')==='a,boost,f,r3,r4',
    'Indsætning får ID fra handlingen, ikke DOM, og ændrer dokumentorden');
  renderDrafts(runtime.getBlocks().map(b=>({id:b.id,source:b.source})));
  await run();
  requireResult(displayedValue('r3')==='= 14' && displayedValue('r4')==='= 21',
    'Indsat definition ændrer den efterfølgende funktions capture i rigtig Pyodide');

  const identity=runtime.getBlock('boost');
  const moved=structure.apply({kind:'move',blockId:'boost',index:4});
  requireResult(moved.kind==='applied' && runtime.getBlock('boost')===identity &&
    runtime.getBlocks().map(b=>b.id).join(',')==='a,f,r3,r4,boost',
    'Flytning bevarer ID/objektidentitet og ændrer den autoritative orden');
  renderDrafts(runtime.getBlocks().map(b=>({id:b.id,source:b.source})));
  await run();
  requireResult(displayedValue('r3')==='= 11' && displayedValue('r4')==='= 18',
    'Flytning ændrer provider-binding tilbage gennem faktisk Pyodide');

  editing.begin('a');editing.replaceSource('a:=');
  const protectedSource=runtime.getBlock('a').source;
  let blocked=false;
  try {structure.apply({kind:'remove',blockId:'a'});} catch(err){
    blocked=err?.message==='S95L_ACTIVE_FORMULA_DRAFT';
  }
  requireResult(blocked && runtime.getBlock('a').source===protectedSource &&
    editing.snapshot()?.source==='a:=',
    'Aktiv ufuldstændig kladde beskytter mod strukturel sletning');
  editing.cancel();

  const removed=structure.apply({kind:'remove',blockId:'boost'});
  requireResult(removed.kind==='applied' && runtime.getBlock('boost')===null,
    'Sletning går gennem DocumentRuntime uden ekstra dokumentmodel');
  renderDrafts(runtime.getBlocks().map(b=>({id:b.id,source:b.source})));
  await run();
  requireResult(displayedValue('r3')==='= 11' && displayedValue('r4')==='= 18',
    'Efter sletning kan dokumentet stadig beregnes af den superviserede Pyodide-Worker');
  say('S97b/S95m: én strukturel handling gennem fælles historik; ingen .ncas-ændring.');
}));

// S95p: transient P0027/P0028 Undo/Redo proof; no .ncas persistence or
// general-purpose student editor. Every transaction goes through the SAME
// authoritative DocumentRuntime and the SAME real Pyodide Worker.
$('accept-95p').addEventListener('click',()=>action('S95p Undo/Redo + rigtig Pyodide',async()=>{
  log.textContent='';
  renderDrafts(DEFAULT);await run();
  requireResult(displayedValue('r3')==='= 11' && displayedValue('r4')==='= 18',
    'Grunddokument: f(3)=11, f(4)=18 via rigtig Pyodide');
  const recalculate=async()=>{
    renderDrafts(runtime.getBlocks().map(b=>({id:b.id,source:b.source})));
    await run();
    return [displayedValue('r3'),displayedValue('r4')].join(',');
  };
  const initial=runtime.getBlocks().map(b=>b.id).join(',');
  const inserted=history.execute([{kind:'insert',blockId:'boost',index:1,taskId:TASK,source:'a:=5'}]);
  requireResult(inserted.kind==='applied' && history.snapshot().canUndo &&
    runtime.getBlocks().map(b=>b.id).join(',')==='a,boost,f,r3,r4',
    'Én autoritativ indsættelse registreres som transaktion');
  requireResult(await recalculate()==='= 14,= 21',
    'Indsat definition genberegner til 14 og 21 via rigtig Pyodide');
  const beforeUndo=revision;
  history.undo();
  requireResult(revision!==beforeUndo && runtime.getBlocks().map(b=>b.id).join(',')===initial &&
    await recalculate()==='= 11,= 18',
    'Undo genskaber oprindelig blokorden og bindinger; epoch går fremad');
  history.redo();
  requireResult(await recalculate()==='= 14,= 21',
    'Redo genindsætter med samme blok-id og giver 14 og 21');

  history.execute([{kind:'move',blockId:'boost',index:4}]);
  requireResult(await recalculate()==='= 11,= 18',
    'Flytning af definition ændrer den matematiske capture til 11 og 18');
  history.undo();
  requireResult(await recalculate()==='= 14,= 21',
    'Undo af flytning genskaber bindingen: 14 og 21');
  history.redo();
  requireResult(await recalculate()==='= 11,= 18',
    'Redo af flytning genberegner 11 og 18');
  history.undo(); // boost back at index 1
  history.execute([{kind:'remove',blockId:'boost'}]);
  requireResult(runtime.getBlock('boost')===null && await recalculate()==='= 11,= 18',
    'Sletning fjerner writer og genberegner via DocumentRuntime');
  history.undo();
  requireResult(runtime.getBlock('boost')?.id==='boost' &&
    await recalculate()==='= 14,= 21',
    'Undo af sletning genskaber originalt id og matematiske bindinger');
  history.execute([{kind:'source',blockId:'boost',source:'a:=8'}]);
  requireResult(await recalculate()==='= 17,= 24',
    'Kildeændring som transaktion giver 17 og 24');
  history.undo();
  requireResult(await recalculate()==='= 14,= 21',
    'Undo af kildeændring genberegner 14 og 21');
  history.execute([{kind:'source',blockId:'boost',source:'a:=6'}]);
  requireResult(!history.snapshot().canRedo && await recalculate()==='= 15,= 22',
    'Ny redigering efter Undo afskærer redo-grenen og genberegner 15 og 22');
  // Leave the TEMPORARY test page in a normal authoritative state.
  say('S95p: P0027/P0028-afprøvning med rigtig Worker. Historik er sessionsdata, ikke .ncas.');
}));

function noteDone(){say('S95f: TEST-only filformat. Ikke .ncas eller elev-UI; faktisk Pyodide Worker.');}
window.addEventListener('pagehide',()=>session.close(),{once:true});
