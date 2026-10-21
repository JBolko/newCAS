import {seedLegacyCalculation} from '../helpers/runtime-fixtures.js';
/** Slice 86a — editor source is data, never executable task input. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {expression} from '../../src/js/values/value.js';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {prepareSemanticEvaluationBatch} from '../../src/js/semantics/prepare-semantic-evaluation-batch.js';
import {dispatchSemanticEvaluationBatch} from '../../src/js/semantics/dispatch-semantic-evaluation-batch.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {orderSemanticRecomputation} from '../../src/js/semantics/order-semantic-recomputation.js';
const legacy={calculate(){throw Error('LEGACY MUST NOT BE CALLED')}, getTaskState(){throw Error('LEGACY MUST NOT BE CALLED')}};
const make=()=>new DocumentRuntime(legacy,'doc');
const add=(rt,id,source,taskId='default')=>rt.addBlock({id,type:'formula',source,taskId});
const batch=(rt,taskId='default')=>rt.prepareSemanticTaskBatch(taskId);
const run=async(rt,evaluate,taskId='default')=>rt.evaluateAndCommitSemanticTask(taskId,{revision:'r1',getCurrentRevision:()=>'r1',evaluate});
const success=blockId=>({blockId,status:'success',value:expression({op:'integer',value:'1'})});

test('invalid middle writer does not hide prior valid writer (#14/#41)',()=>{
 const rt=make();add(rt,'first','a := 4');add(rt,'bad','a := )(');add(rt,'use','b := a+1');
 assert.equal(rt.deriveSemanticTask().analysis.bindings.get('use').get('a'),'first');
 assert.deepEqual(rt.getBlock('bad').dependencies,{reads:[],writes:[]});
 assert.ok(rt.deriveSemanticTask().snapshot.blocks[1].parseError);
});
test('multi-statement block has no accidental positional writer or evaluator call',async()=>{
 const rt=make();add(rt,'first','a := 4');add(rt,'multi','a := 7; c := 2');add(rt,'use','b := a+1');
 assert.equal(rt.deriveSemanticTask().analysis.bindings.get('use').get('a'),'first');
 let called=[];const result=await run(rt,async t=>{called.push(t.blockId);return success(t.blockId)});
 assert.equal(result.kind,'complete');
 assert.deepEqual(called,['first','use']);
 assert.equal(rt.getBlock('multi').calculation.error.code,'INVALID_SOURCE');
});
test('invalid blocks never cross evaluation boundary; unrelated valid blocks continue',async()=>{
 const rt=make();add(rt,'a','a := 1');add(rt,'bad','a :=');add(rt,'b','b := 2');add(rt,'other','c := 3','other');
 const calls=[];const result=await run(rt,async t=>{calls.push(t.blockId);return success(t.blockId)});
 assert.equal(result.kind,'complete');assert.deepEqual(calls,['a','b']);
 assert.equal(rt.getBlock('bad').calculation.status,'error');
 assert.equal(rt.getBlock('bad').calculation.error.code,'INVALID_SOURCE');
 assert.equal(rt.getBlock('a').calculation.status,'success');
 assert.equal(rt.getBlock('b').calculation.status,'success');
 assert.equal(rt.getBlock('other').calculation.status,'idle');
});
test('invalid task cannot spoof successful outcome in batch commit',async()=>{
 const rt=make();add(rt,'broken','x :=');
 const prepared=batch(rt);
 let called=0;
 const outcome=await dispatchSemanticEvaluationBatch(prepared,{revision:'r',getCurrentRevision:()=>'r',evaluate:()=>{called++;return success('broken')}});
 assert.equal(called,0);assert.equal(outcome.state.outcomes[0].code,'INVALID_SOURCE');
});
test('bad source type rejected BEFORE document mutation',()=>{
 const rt=make();add(rt,'a','a := 1');const prior=rt.getBlock('a').calculation.generation;
 assert.throws(()=>rt.setBlockSource('a',{}),/source must be a string/);
 assert.equal(rt.getBlock('a').source,'a := 1');assert.equal(rt.getBlock('a').calculation.generation,prior);
});
test('editing invalid writer to valid switches bindings and invalidates previous downstream result',async()=>{
 const rt=make();add(rt,'first','a := 4');add(rt,'middle','a :=');add(rt,'use','b := a+1');
 const consumer=rt.getBlock('use');await seedLegacyCalculation(rt,'use',{result:42});
 rt.setBlockSource('middle','a := 7');
 assert.equal(rt.deriveSemanticTask().analysis.bindings.get('use').get('a'),'middle');
 assert.equal(rt.getBlock('use').calculation.status,'dirty');
 assert.equal(rt.getBlock('use').calculation.result,null);
});
