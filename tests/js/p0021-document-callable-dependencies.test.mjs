import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {planSemanticRecomputation} from '../../src/js/semantics/plan-semantic-recomputation.js';
import {orderSemanticRecomputation} from '../../src/js/semantics/order-semantic-recomputation.js';
import {prepareSemanticEvaluationBatch} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';

const b=(id,source)=>({id,source});
const initial=[b('x','x:=12'),b('f','f(t):=t^3+4t'),b('call','f(x)'),b('unrelated','7+8')];
const make=blocks=>{
 const snapshot=deriveSourceSemanticSnapshot(blocks,parse,'task');
 return {snapshot,analysis:projectSemanticDependencyAnalysis(snapshot)};
};
const all=make(initial);

test('S39: actual parser and P0020 binding give f(x) both x and f providers',()=>{
 assert.deepEqual([...all.analysis.bindings.get('call')].sort(),[['f','f'],['x','x']]);
 assert.deepEqual([...all.analysis.graph.getUpstream('call')].sort(),['f','x']);
 assert.equal(all.snapshot.blocks[2].calls[0].providerId,'f');
});
test('S39: source change to x only recomputes x and call, not function or unrelated',()=>{
 const after=make([b('x','x:=3'),...initial.slice(1)]);
 const plan=planSemanticRecomputation(all.analysis,after.analysis,['x']);
 assert.deepEqual([...plan.recompute].sort(),['call','x']);
 const schedule=orderSemanticRecomputation(after.analysis,plan);
 assert.deepEqual(schedule.order,['x','call']);
 const sources=new Map([['x','x:=3'],['f','f(t):=t^3+4t'],['call','f(x)'],['unrelated','7+8']]);
 const batch=prepareSemanticEvaluationBatch(after.snapshot,after.analysis,schedule,sources,['f','unrelated']);
 assert.deepEqual(batch.tasks.map(t=>t.blockId),['x','call']);
 assert.deepEqual(batch.tasks[1].providers.map(p=>p.name).sort(),['f','x']);
 assert.deepEqual([...batch.tasks[1].upstream].sort(),['f','x']);
});
test('S39: changing f invalidates call, never the independent x',()=>{
 const after=make([initial[0],b('f','f(t):=t^2'),...initial.slice(2)]);
 const plan=planSemanticRecomputation(all.analysis,after.analysis,['f']);
 assert.deepEqual([...plan.recompute].sort(),['call','f']);
});
test('S39: function redefinition to nearest writer is detected as rebinding',()=>{
 const after=make([initial[0],initial[1],b('f2','f(t):=t+1'),...initial.slice(2)]);
 const plan=planSemanticRecomputation(all.analysis,after.analysis,[]);
 assert.equal(after.analysis.bindings.get('call').get('f'),'f2');
 assert.ok(plan.bindingChanges.has('call'));
 assert.ok(plan.recompute.has('call'));
});
test('S39: forged callable provider cannot introduce arbitrary graph edge',()=>{
 const forged={...all.snapshot,blocks:all.snapshot.blocks.map(b=> b.blockId==='call'?{...b,calls:[{...b.calls[0],providerId:'ghost'}]}:b)};
 assert.throws(()=>projectSemanticDependencyAnalysis(forged),/callable provider/);
});
test('S39: builtin calls do not become fake document providers',()=>{
 const {analysis}=make([b('a','sin(1)')]);
 assert.deepEqual([...analysis.bindings.get('a')],[]);
});
