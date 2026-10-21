import {seedLegacyCalculation} from '../helpers/runtime-fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentRuntime } from '../../src/js/document-runtime.js';

function runtime() {
  return new DocumentRuntime({async calculate(){return {answer:42};}},'document');
}
function setup() {
  const doc=runtime();
  doc.addBlock({id:'first',type:'formula',source:'a:=1'});
  doc.addBlock({id:'read',type:'formula',source:'a+1'});
  return doc;
}
async function successful(doc,id,result={value:999}) {
  await seedLegacyCalculation(doc,id,{result});
  return doc.getBlock(id).calculation.generation;
}

test('deleting a writer clears the old successful downstream value immediately',async()=>{
  const doc=setup(); const generation=await successful(doc,'read');
  assert.deepEqual(doc.removeBlock('first'),new Set(['read']));
  assert.deepEqual(doc.getBlock('read').calculation,{
    status:'dirty',generation:generation+1,result:null,error:null
  });
});

test('inserting a closer writer clears the old successful downstream value',async()=>{
  const doc=setup();await successful(doc,'read',{value:2});
  assert.deepEqual(doc.insertBlock({id:'second',type:'formula',source:'a:=10'},1),new Set(['read']));
  assert.equal(doc.getBlock('read').calculation.result,null);
  assert.equal(doc.getBlock('read').calculation.status,'dirty');
});

test('dirtying clears a previous diagnostic as well as an old result',async()=>{
  const doc=setup();const calculation=doc.getBlock('read').calculation;
  await seedLegacyCalculation(doc,'read',{status:'error'});
  doc.removeBlock('first');
  assert.equal(doc.getBlock('read').calculation.error,null);
  assert.equal(doc.getBlock('read').calculation.status,'dirty');
});

test('late legacy calculation cannot restore result after writer deletion',async()=>{
  let finish;
  const engine={calculate:()=>new Promise(resolve=>{finish=resolve;})};
  const doc=new DocumentRuntime(engine,'document');
  doc.addBlock({id:'first',type:'formula',source:'a:=1'});
  doc.addBlock({id:'read',type:'formula',source:'a+1'});
  const pending=doc.calculateBlock('read');
  doc.removeBlock('first');
  finish({value:999});
  assert.equal(await pending,null);
  assert.equal(doc.getBlock('read').calculation.result,null);
  assert.equal(doc.getBlock('read').calculation.status,'dirty');
});

test('a structurally unrelated block retains its successful result',async()=>{
  const doc=setup();doc.addBlock({id:'unrelated',type:'formula',source:'b:=7'});
  const result={value:7};await successful(doc,'unrelated',result);
  doc.removeBlock('first');
  assert.equal(doc.getBlock('unrelated').calculation.status,'success');
  assert.deepEqual(doc.getBlock('unrelated').calculation.result,result);
});
