import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
const create=()=>new DocumentRuntime({async calculate(){throw new Error('legacy engine must not be called');}},'doc');
const add=(d,id,source,taskId='default')=>d.addBlock({id,type:'formula',source,taskId});
const provider=(d,id,name,task='default')=>d.deriveSemanticTask(task).analysis.bindings.get(id)?.get(name);
function fixture(){const d=create();add(d,'f1','f(x):=x^2+3x');add(d,'a','f(10)');add(d,'f2','f(x):=2x+1');add(d,'b','f(3)');return d;}
test('runtime projects nearest preceding callable bindings directly from owned block order',()=>{
 const d=fixture();const {snapshot,analysis}=d.deriveSemanticTask();
 assert.equal(snapshot.blocks.length,4);
 assert.equal(analysis.bindings.get('a').get('f'),'f1');
 assert.equal(analysis.bindings.get('b').get('f'),'f2');
 assert.deepEqual([...analysis.graph.getUpstream('a')],['f1']);
});
test('removal invalidates an earlier call without name fallback, later call still bound',()=>{
 const d=fixture();d.removeBlock('f1');
 assert.equal(provider(d,'a','f'),undefined);
 assert.equal(provider(d,'b','f'),'f2');
 const a=d.deriveSemanticTask().snapshot.blocks.find(b=>b.blockId==='a');
 assert.equal(a.calls[0].providerId,null);
});
test('removing later definition rebinds subsequent call to first writer',()=>{
 const d=fixture();d.removeBlock('f2');assert.equal(provider(d,'b','f'),'f1');
});
test('insertion of a definition only changes later calls',()=>{
 const d=create();add(d,'f1','f(x):=x^2+3x');add(d,'a','f(10)');add(d,'b','f(3)');
 d.insertBlock({id:'f2',type:'formula',source:'f(x):=2x+1'},2);
 assert.equal(provider(d,'a','f'),'f1');assert.equal(provider(d,'b','f'),'f2');
});
test('projection follows source edits without mutation of prior snapshots',()=>{
 const d=fixture();const old=d.deriveSemanticTask();
 d.setBlockSource('f2','g(x):=2x+1');
 assert.equal(provider(d,'b','f'),'f1');
 assert.equal(old.analysis.bindings.get('b').get('f'),'f2');
});
test('projection excludes text and other tasks; no Python engine calls',()=>{
 const d=create();add(d,'f','f(x):=x^2','one');d.addBlock({id:'text',type:'text',source:'f(x)'});
 add(d,'a','f(10)','one');add(d,'b','f(3)','two');
 assert.equal(provider(d,'a','f','one'),'f');
 assert.equal(provider(d,'b','f','two'),undefined);
 assert.deepEqual(d.deriveSemanticTask('one').snapshot.blocks.map(b=>b.blockId),['f','a']);
});
test('derived analysis does not write into legacy dependency graph or calculation state',()=>{
 const d=fixture();const before=d.blocks.map(b=>b.calculation);
 const legacy=d.dependencyAnalysis;
 d.deriveSemanticTask();
 assert.strictEqual(d.dependencyAnalysis,legacy);
 for(let i=0;i<before.length;i++)assert.strictEqual(d.blocks[i].calculation,before[i]);
 assert.throws(()=>d.deriveSemanticTask(''),/taskId/);
});
