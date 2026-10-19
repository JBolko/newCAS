/** S95f — test-only variable-length fixture and DocumentRuntime structural projection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';
import {parseS95fTestFixture,validateS95fDrafts,S95F_VERSION,S95F_MAX_BYTES,S95F_MAX_BLOCKS} from
  '../browser/p0021-slice-95f-test-fixture.mjs';
import {reconcileS95fDraftStructure} from '../browser/p0021-slice-95f-draft-structure.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const B=[{id:'a',source:'a:=2'},{id:'f',source:'f(t):=t^2+a'},{id:'r3',source:'f(3)'}];
const raw=(blocks=B, extra={})=>JSON.stringify({fixtureVersion:S95F_VERSION,blocks,...extra});
const bad=(input,diagnostic)=>assert.throws(()=>parseS95fTestFixture(input),new RegExp(diagnostic));
function harness(initial=B) {
  const runtime=DocumentRuntime.createSemantic('s95f-test');
  for(const b of initial)runtime.addBlock({id:b.id,type:'formula',taskId:'pilot',source:b.source});
  let revision='r0',count=0;
  const advanceRevision=()=>{revision=`r${++count}`;};
  const session={run:async()=>({kind:'complete'})};
  const action=createSemanticCalculateAction({runtime,session,taskId:'pilot',
    getCurrentRevision:()=>revision,advanceRevision});
  async function calculate(drafts) {
    const rows=validateS95fDrafts(drafts);
    reconcileS95fDraftStructure({runtime,taskId:'pilot',advanceRevision,getCurrentRevision:()=>revision},rows);
    return action.calculate(rows.map(b=>({blockId:b.id,source:b.source})));
  }
  return {runtime,calculate,advanceRevision,get revision(){return revision;},get changes(){return count;}};
}

test('S95f provided 5-block fixture keeps source spellings and original order',()=>{
  const decoded=parseS95fTestFixture(read('tests/browser/fixtures/p0021-slice-95f-five-formulas.json'));
  assert.equal(decoded.length,5);
  assert.deepEqual(decoded.map(r=>r.id),['a','f','r3','r4','r5']);
  assert.ok(Object.isFrozen(decoded) && decoded.every(Object.isFrozen));
});
test('S95f format admits 1 and maximum 32 blocks, not 0 or 33',()=>{
  assert.equal(parseS95fTestFixture(raw([{id:'a',source:''}])).length,1);
  const many=Array.from({length:S95F_MAX_BLOCKS},(_,i)=>({id:`b${i}`,source:`${i}`}));
  assert.equal(parseS95fTestFixture(raw(many)).length,32);
  bad(raw([]),'S95F_BLOCK_COUNT');bad(raw([...many,{id:'b32',source:'33'}]),'S95F_BLOCK_COUNT');
});
test('S95f malformed JSON, wrong version, extra keys, and null root fail closed',()=>{
  bad('{','S95F_FIXTURE_JSON');bad('null','S95F_FIXTURE_SHAPE');
  bad(raw(B,{extra:true}),'S95F_FIXTURE_SHAPE');
  bad(JSON.stringify({fixtureVersion:'newCAS-test-sources-v1',blocks:B}),'S95F_FIXTURE_SHAPE');
});
test('S95f duplicate IDs, unsafe IDs and foreign block fields are rejected',()=>{
  bad(raw([{id:'a',source:'1'},{id:'a',source:'2'}]),'S95F_BLOCK_INVALID');
  for(const id of ['__proto__','../x','', 'A'.repeat(65)])
    bad(raw([{id,source:'1'}]),'S95F_BLOCK_INVALID');
  bad(raw([{id:'a',source:'1',taskId:'foreign'}]),'S95F_BLOCK_INVALID');
  bad(raw([{id:'a',source:'1',calculation:{status:'success'}}]),'S95F_BLOCK_INVALID');
});
test('S95f source size/type/null restrictions and fixture byte limit are enforced',()=>{
  bad(raw([{id:'a',source:null}]),'S95F_BLOCK_INVALID');
  bad(raw([{id:'a',source:'x\0y'}]),'S95F_BLOCK_INVALID');
  bad(raw([{id:'a',source:'x'.repeat(1025)}]),'S95F_BLOCK_INVALID');
  bad(' '.repeat(S95F_MAX_BYTES+1),'S95F_FIXTURE_SIZE');
  bad(undefined,'S95F_FIXTURE_SIZE');
});
test('S95f preserves mathematically incomplete source as data without parsing',()=>{
  assert.equal(parseS95fTestFixture(raw([{id:'z',source:'f('}]))[0].source,'f(');
});
test('S95f changing only draft rows leaves authoritative runtime unchanged',()=>{
  const h=harness();
  const draft=parseS95fTestFixture(raw([...B,{id:'r4',source:'f(4)'}]));
  assert.equal(draft.length,4);assert.equal(h.runtime.getBlocks().length,3);
  assert.equal(h.runtime.getBlock('r4'),null);assert.equal(h.changes,0);
});
test('S95f invalid later row is rejected before structural write or revision change',()=>{
  const h=harness();
  assert.throws(()=>reconcileS95fDraftStructure({runtime:h.runtime,taskId:'pilot',advanceRevision:h.advanceRevision,getCurrentRevision:()=>h.revision},
    [{id:'a',source:'a:=5'},{id:'unsafe/id',source:'1'}]),/S95F_BLOCK_INVALID/);
  assert.equal(h.runtime.getBlocks().length,3);assert.equal(h.revision,'r0');
});
test('S95f inserts an additional block using existing DocumentRuntime API',async()=>{
  const h=harness();
  await h.calculate([...B,{id:'r4',source:'f(4)'}]);
  assert.deepEqual(h.runtime.getBlocks().map(b=>b.id),['a','f','r3','r4']);
  assert.equal(h.runtime.getBlock('r4').source,'f(4)');assert.equal(h.changes,1);
});
test('S95f removes blocks via DocumentRuntime on explicit Calculate only',async()=>{
  const h=harness([...B,{id:'r4',source:'f(4)'},{id:'r5',source:'f(5)'}]);
  await h.calculate(B);
  assert.deepEqual(h.runtime.getBlocks().map(b=>b.id),['a','f','r3']);
  assert.equal(h.runtime.getBlock('r5'),null);assert.equal(h.changes,1);
});
test('S95f reorders blocks through authoritative runtime moveBlock',async()=>{
  const h=harness();
  await h.calculate([B[2],B[0],B[1]]);
  assert.deepEqual(h.runtime.getBlocks().map(b=>b.id),['r3','a','f']);
  assert.equal(h.changes,1);
});
test('S95f changing only source delegates to existing S95e Calculate action',async()=>{
  const h=harness();
  await h.calculate([{id:'a',source:'a:=5'},...B.slice(1)]);
  assert.equal(h.runtime.getBlock('a').source,'a:=5');
  assert.equal(h.runtime.getBlocks().length,3);assert.equal(h.changes,1);
});
test('S95f unchanged structural drafts do not change revision',async()=>{
  const h=harness();await h.calculate(B);
  assert.equal(h.changes,0);assert.equal(h.runtime.getBlock('a').calculation.generation,0);
});
test('S95f structural edits advance revision before runtime mutation',()=>{
  const h=harness();
  const insert=h.runtime.insertBlock.bind(h.runtime);
  h.runtime.insertBlock=(...args)=>{assert.equal(h.revision,'r1');return insert(...args);};
  reconcileS95fDraftStructure({runtime:h.runtime,taskId:'pilot',advanceRevision:h.advanceRevision,getCurrentRevision:()=>h.revision},
    [...B,{id:'r4',source:'f(4)'}]);
});
test('S95f refuses to structurally edit a runtime with unrelated task or text blocks',()=>{
  const h=harness();h.runtime.addBlock({id:'foreign',type:'formula',taskId:'other',source:'a:=5'});
  assert.throws(()=>reconcileS95fDraftStructure({runtime:h.runtime,taskId:'pilot',advanceRevision:h.advanceRevision,getCurrentRevision:()=>h.revision},
    [...B,{id:'r4',source:'f(4)'}]),/S95F_FOREIGN_DOCUMENT/);
  assert.equal(h.changes,0);
});
test('S95f existing selected runtime computes 4 and 5 formula blocks without legacy',async()=>{
  const h=harness();const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
    operationId:id,evaluatorId:`probe.scalar.${id}`,
    arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
  const backend=async (_,request)=>{
    const [a,b]=request.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
    const id=request.evaluationRequest.evaluatorId;
    const n=id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b;
    return {blockId:request.blockId,status:'success',value:expression({op:'integer',value:String(n)})};
  };
  let revision='r0';
  const advanceRevision=()=>{revision+='+';};
  const session={run:()=>{
    const {snapshot}=h.runtime.deriveSemanticTask('pilot');
    const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:backend,revision});
    return h.runtime.evaluateAndCommitSemanticTask('pilot',{revision,
      getCurrentRevision:()=>revision,evaluate});
  }};
  const action=createSemanticCalculateAction({runtime:h.runtime,session,taskId:'pilot',
    getCurrentRevision:()=>revision,advanceRevision});
  const calc=async drafts=>{
    reconcileS95fDraftStructure({runtime:h.runtime,taskId:'pilot',advanceRevision,getCurrentRevision:()=>revision},drafts);
    return action.calculate(drafts.map(b=>({blockId:b.id,source:b.source})));
  };
  assert.equal((await calc([...B,{id:'r4',source:'f(4)'}])).kind,'complete');
  assert.equal(h.runtime.getBlock('r3').calculation.result.data.expr.value,'11');
  assert.equal(h.runtime.getBlock('r4').calculation.result.data.expr.value,'18');
  const expanded=[{id:'a',source:'a:=5'},...B.slice(1),{id:'r4',source:'f(4)'},{id:'r5',source:'f(5)'}];
  assert.equal((await calc(expanded)).kind,'complete');
  assert.equal(h.runtime.getBlock('r3').calculation.result.data.expr.value,'14');
  assert.equal(h.runtime.getBlock('r4').calculation.result.data.expr.value,'21');
  assert.equal(h.runtime.getBlock('r5').calculation.result.data.expr.value,'30');
});
test('S95f unchanged revision fails before structural edit',()=>{
  const h=harness();
  assert.throws(()=>reconcileS95fDraftStructure({runtime:h.runtime,taskId:'pilot',
    advanceRevision:()=>{},getCurrentRevision:()=>h.revision},
    [...B,{id:'r4',source:'f(4)'}]),/S95F_REVISION_UNCHANGED/);
  assert.equal(h.runtime.getBlock('r4'),null);
});
test('S95f malformed revision fails before structural edit',()=>{
  const h=harness();
  assert.throws(()=>reconcileS95fDraftStructure({runtime:h.runtime,taskId:'pilot',
    advanceRevision:h.advanceRevision,getCurrentRevision:()=>''},
    [...B,{id:'r4',source:'f(4)'}]),/S95F_REVISION_INVALID/);
  assert.equal(h.runtime.getBlock('r4'),null);
});
test('S95f browser page stays test-only, import only drafts, no unsafe HTML evaluation',()=>{
  const html=read('tests/browser/p0021-slice-95f-dynamic-document.html');
  const js=read('tests/browser/p0021-slice-95f-dynamic-document.mjs');
  assert.match(html,/id="fixture-file"/);assert.match(html,/id="accept-95f"/);
  assert.match(html,/Ikke elev-UI|ikke elev-UI/);
  assert.match(js,/renderDrafts\(parseS95fTestFixture\(await file\.text\(\)\)\)/);
  assert.match(js,/reconcileS95fDraftStructure/);
  assert.match(js,/createSemanticCalculateAction/);
  assert.match(js,/selected-pyodide-worker\.js/);
  assert.doesNotMatch(js,/\.innerHTML\s*=|\.outerHTML\s*=|\beval\s*\(/);
});
test('S95f static browser import graph excludes legacy engine and test doubles',()=>{
  const graph=traceStaticGraph(ROOT,'tests/browser/p0021-slice-95f-dynamic-document.mjs');
  assert.deepEqual(graph.unresolved,[]);
  for(const id of ['src/js/cas-engine.js','src/js/transformer.js',
    'tests/browser/p0021-slice-94e-math-fixture-worker.mjs'])
    assert.equal(graph.modules.includes(id),false,id);
});
