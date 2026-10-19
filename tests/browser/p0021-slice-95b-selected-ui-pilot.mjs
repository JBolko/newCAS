/** P0021 S95b — explicit, non-production UI wiring probe.
 * No replacement editor, scheduler, semantic resolver, evaluator, renderer,
 * persistent Python task scope or automatic replay. Source commits occur ONLY
 * on the user's explicit Calculate action; inputs are draft buffers.
 * All output uses textContent, never innerHTML.
 */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';
import {parseS95cTestFixture, S95C_MAX_FIXTURE_BYTES} from './p0021-slice-95c-test-fixture.mjs';

const $ = id => document.getElementById(id);
const inputs = [['pilot-a', $('source-a'), $('result-a')],
                ['pilot-f', $('source-f'), $('result-f')],
                ['pilot-result', $('source-result'), $('result-result')]];
const status = $('status');
const log = $('log');
const buttons = [$('evaluate'), $('restart'), $('accept'), $('load-fixture'), $('accept-95c')];
const note = message => { log.textContent += `${message}\n`; };
const requireResult = (condition, message) => {if (!condition) throw new Error(message);note(`PASS: ${message}`);};
const specs = new Map(['add','multiply','power'].map(id => [id, operationSpec({
  operationId:id, evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));

// Explicit semantic-only document: no CASEngine-shaped sentinel or fallback.
const runtime = DocumentRuntime.createSemantic('s95b-pilot');
for (const [blockId, input] of inputs) {
  runtime.addBlock({id:blockId, type:'formula', taskId:'pilot', source:input.value});
}
let serial = 0;
let revision = `s95b-${serial}`;
const nextRevision = () => {revision = `s95b-${++serial}`;};
const session = createSupervisedSemanticTaskSession({
  runtime, taskId:'pilot',
  createWorker:()=>new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'}),
  supervision:{timeoutMs:180_000,maxPending:1},
  getCurrentRevision:()=>revision,
  advanceRevision:nextRevision,
  createEvaluate:({snapshot,revision:batchRevision,cachedOutcomes,evaluateSelected})=>
    createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:evaluateSelected,
      revision:batchRevision,cachedOutcomes}),
});

// A file import changes DRAFT fields ONLY, not authoritative DocumentRuntime.
function applyFixtureToDrafts(fixture) {
  const drafts = parseS95cTestFixture(fixture); // validate ALL before changing ANY field
  for (const {id, source} of drafts) {
    const entry = inputs.find(([blockId]) => blockId === id);
    if (!entry) throw new Error('S95C_FIXTURE_ID'); // defensive fail closed
    entry[1].value = source;
  }
}
// Host still owns revision; the shared action owns only the explicit UI boundary.
const calculateAction = createSemanticCalculateAction({
  runtime, session, taskId:'pilot', getCurrentRevision:()=>revision,
  advanceRevision:nextRevision,
});
function displayOutcomes() {
  for (const [blockId, ,output] of inputs) {
    const slot = runtime.getBlock(blockId).calculation;
    if (slot.status === 'success') {
      const number = slot.result?.data?.expr?.value;
      output.textContent = number === undefined ? `OK (${slot.result.kind})` : `= ${number}`;
    } else {
      const diagnostic = slot.error?.diagnostic?.code ?? slot.error?.code;
      output.textContent = diagnostic ? `${slot.status}: ${diagnostic}` : slot.status;
    }
  }
}
async function run() {
  const outcome = await calculateAction.calculate(
    inputs.map(([blockId,input])=>({blockId,source:input.value})));
  displayOutcomes();
  if (outcome.kind !== 'complete') throw new Error(`Batch did not complete: ${outcome.kind}`);
  return outcome;
}
function setBusy(value) {
  for(const button of buttons) button.disabled = value;
  for(const [,input] of inputs) input.disabled = value;
  $('fixture-file').disabled = value;
}
async function action(label, handler) {
  setBusy(true);status.className='pending';status.textContent=label;
  try {
    await handler();
    status.className='pass';status.textContent=`PASS — ${label}`;
  } catch(error) {
    status.className='fail';status.textContent=`FAIL — ${label}`;
    note(`ERROR: ${error?.message ?? String(error)}`);
  } finally {setBusy(false);}
}
$('evaluate').addEventListener('click',()=>action('Beregning via udvalgt IR/Worker',run));
$('restart').addEventListener('click',()=>action('Eksplicit Worker-genstart',()=>{
  session.restart();note('Worker udskiftet; ingen automatisk beregning.');
}));
$('accept').addEventListener('click',()=>action('S95b-browseraccept',async()=>{
  log.textContent='';
  $('source-a').value='a:=2';
  $('source-f').value='f(t):=t^2+a';
  $('source-result').value='f(3)';
  await run();
  requireResult(runtime.getBlock('pilot-result').calculation.result?.data?.expr?.value==='11',
    'Tre UI-inputfelter → attesteret IR → rigtig Pyodide: f(3)=11');
  requireResult(runtime.getBlock('pilot-a').source==='a:=2',
    'DocumentRuntime ejer autoritativ kilde efter eksplicit beregning');
  $('source-a').value='a:=5';
  requireResult(runtime.getBlock('pilot-a').source==='a:=2',
    'Uredigeret dokument indtil eksplicit kildecommit');
  await run();
  requireResult(runtime.getBlock('pilot-result').calculation.result?.data?.expr?.value==='14',
    'Kildeændring invaliderer afhængig funktion og giver f(3)=14');
  const prior = runtime.getBlock('pilot-result').calculation.generation;
  session.restart();
  requireResult(runtime.getBlock('pilot-result').calculation.generation===prior,
    'Transportgenstart ændrer ikke dokumentets blokgeneration');
  await run();
  requireResult(runtime.getBlock('pilot-result').calculation.result?.data?.expr?.value==='14',
    'Eksplicit ny evaluering efter Worker-genstart bevarer gyldigt resultat');
  note('S95b: valgt matematik kørte i Pyodide-Worker. Pilot er IKKE produktions-UI.');
}));

$('load-fixture').addEventListener('click',()=>action('Testfil indlæst som kladde (ikke beregnet)',async()=>{
  const file = $('fixture-file').files?.[0];
  if (!file) throw new Error('Vælg først en lokal JSON-testfil.');
  if (file.size > S95C_MAX_FIXTURE_BYTES) throw new Error('S95C_FIXTURE_SIZE');
  applyFixtureToDrafts(await file.text());
  note('S95c: Kun kladdefelter ændret. Tryk Beregn dokumentet for at committe.');
}));
$('accept-95c').addEventListener('click',()=>action('S95c-filimport + rigtig Pyodide',async()=>{
  log.textContent='';
  const response = await fetch('./fixtures/p0021-slice-95c-three-formulas.json',{cache:'no-store'});
  if (!response.ok) throw new Error(`Testfil kunne ikke hentes: HTTP ${response.status}`);
  const fixture = await response.text();
  // Establish a different committed source BEFORE importing the fixture.
  $('source-a').value='a:=5';
  $('source-f').value='f(t):=t^2+a';
  $('source-result').value='f(3)';
  await run();
  requireResult(runtime.getBlock('pilot-result').calculation.result?.data?.expr?.value==='14',
    'Før indlæsning: faktisk Pyodide-resultat 14');
  applyFixtureToDrafts(fixture);
  requireResult($('source-a').value==='a:=2' && runtime.getBlock('pilot-a').source==='a:=5',
    'Filimport ændrer kladden, men ikke DocumentRuntimes kilde');
  await run();
  requireResult(runtime.getBlock('pilot-result').calculation.result?.data?.expr?.value==='11',
    'Efter eksplicit beregning: indlæst testfil giver 11 via Pyodide');
  requireResult(runtime.getBlock('pilot-a').source==='a:=2',
    'DocumentRuntime overtager først filens kilde ved Beregn');
  note('S95c: Midlertidigt testformat. Ikke .ncas, ikke release, ingen legacy.');
}));
window.addEventListener('pagehide',()=>session.close(),{once:true});
