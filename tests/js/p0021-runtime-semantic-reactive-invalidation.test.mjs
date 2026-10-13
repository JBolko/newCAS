import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
const make=()=>new DocumentRuntime({calculate(){throw Error('legacy evaluator called');}},'doc');
const add=(d,id,source,taskId='default')=>d.addBlock({id,type:'formula',source,taskId});
const success=(d,id,value)=>{const b=d.getBlock(id);b.calculation={status:'success',generation:0,result:value,error:null};};
const status=(d,id)=>d.getBlock(id).calculation;
function fixture(){const d=make();add(d,'f1','f(x):=x^2+3x');add(d,'a','f(10)');add(d,'f2','f(x):=2x+1');add(d,'b','f(3)');for(const id of ['f1','a','f2','b'])success(d,id,id);return d;}
test('remove first definition invalidates earlier call and clears result, never later call',()=>{const d=fixture();d.removeBlock('f1');assert.equal(status(d,'a').status,'dirty');assert.equal(status(d,'a').result,null);assert.equal(status(d,'b').status,'success');assert.equal(status(d,'b').result,'b');assert.equal(d.deriveSemanticTask().snapshot.blocks.find(b=>b.blockId==='a').calls[0].providerId,null);});
test('remove later definition invalidates rebound call, not preceding call',()=>{const d=fixture();d.removeBlock('f2');assert.equal(status(d,'b').status,'dirty');assert.equal(status(d,'b').result,null);assert.equal(status(d,'a').status,'success');assert.equal(d.deriveSemanticTask().analysis.bindings.get('b').get('f'),'f1');});
test('insert later function invalidates only subsequently rebound call',()=>{const d=make();add(d,'f1','f(x):=x^2+3x');add(d,'a','f(10)');add(d,'b','f(3)');success(d,'a',130);success(d,'b',18);d.insertBlock({id:'f2',type:'formula',source:'f(x):=2x+1'},2);assert.equal(status(d,'a').result,130);assert.equal(status(d,'b').result,null);assert.equal(status(d,'b').status,'dirty');});
test('editing writer to new name invalidates downstream provider call',()=>{const d=fixture();d.setBlockSource('f2','g(x):=2x+1');assert.equal(status(d,'b').status,'dirty');assert.equal(status(d,'b').result,null);assert.equal(status(d,'a').status,'success');});
test('separate task scope unaffected by redefinition',()=>{const d=fixture();add(d,'other','f(3)','other-task');success(d,'other',42);d.removeBlock('f1');assert.equal(status(d,'other').result,42);});
test('moving function definition rebinding clears old calculation',()=>{const d=fixture();d.moveBlock('f2',1);assert.equal(status(d,'a').status,'dirty');assert.equal(status(d,'a').result,null);assert.equal(status(d,'b').status,'success');});
