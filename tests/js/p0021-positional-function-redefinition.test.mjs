import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {planSemanticRecomputation} from '../../src/js/semantics/plan-semantic-recomputation.js';
import {orderSemanticRecomputation} from '../../src/js/semantics/order-semantic-recomputation.js';
import {prepareSemanticEvaluationBatch} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';

const block=(id,source)=>({id,source});
const before=[block('f1','f(x):=x^2+3x'),block('ten','f(10)'),block('three','f(3)'),block('other','2+3')];
const after=[before[0],before[1],block('f2','f(x):=2x+1'),before[2],before[3]];
function derive(blocks){ const snapshot=deriveSourceSemanticSnapshot(blocks,parse,'task');return {snapshot,analysis:projectSemanticDependencyAnalysis(snapshot)}; }
const old=derive(before), current=derive(after);
const callProvider=(model,id)=>model.snapshot.blocks.find(b=>b.blockId===id).calls[0].providerId;
const upstream=(model,id)=>[...model.analysis.graph.getUpstream(id)].sort();

test('S41 initial source calls both bind to first definition',()=>{
 assert.equal(callProvider(old,'ten'),'f1'); assert.equal(callProvider(old,'three'),'f1');
 assert.deepEqual(upstream(old,'ten'),['f1']);assert.deepEqual(upstream(old,'three'),['f1']);
});
test('S41 inserted writer only rebinds later f(3), never preceding f(10)',()=>{
 assert.equal(callProvider(current,'ten'),'f1'); assert.equal(callProvider(current,'three'),'f2');
 assert.deepEqual(upstream(current,'ten'),['f1']); assert.deepEqual(upstream(current,'three'),['f2']);
 assert.equal(current.analysis.bindings.get('ten').get('f'),'f1');
 assert.equal(current.analysis.bindings.get('three').get('f'),'f2');
});
test('S41 insertion invalidates only inserted writer and later call',()=>{
 const plan=planSemanticRecomputation(old.analysis,current.analysis,[]);
 assert.deepEqual([...plan.inserted],['f2']);
 assert.deepEqual([...plan.bindingChanges],['three']);
 assert.deepEqual([...plan.recompute].sort(),['f2','three']);
 const schedule=orderSemanticRecomputation(current.analysis,plan);
 assert.deepEqual(schedule.order,['f2','three']);
 const batch=prepareSemanticEvaluationBatch(current.snapshot,current.analysis,schedule,new Map(after.map(b=>[b.id,b.source])),['f1','ten','other']);
 assert.deepEqual(batch.tasks.map(t=>t.blockId),['f2','three']);
 assert.deepEqual(batch.tasks[1].providers,[{name:'f',providerId:'f2'}]);
});
test('S41 editing earlier definition invalidates earlier call, not later shadowed call',()=>{
 const modified=derive([block('f1','f(x):=x^2'),...after.slice(1)]);
 const plan=planSemanticRecomputation(current.analysis,modified.analysis,['f1']);
 assert.deepEqual([...plan.recompute].sort(),['f1','ten']);
});
test('S41 removing inserted definition restores previous provider and invalidates later call',()=>{
 const plan=planSemanticRecomputation(current.analysis,old.analysis,[]);
 assert.deepEqual([...plan.removed],['f2']);
 assert.deepEqual([...plan.bindingChanges],['three']);
 assert.deepEqual([...plan.recompute],['three']);
});
