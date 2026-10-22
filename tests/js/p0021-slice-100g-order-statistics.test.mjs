import test from 'node:test';
import assert from 'node:assert/strict';
import {findSelectedOperationSpec,selectedOperationSpecs} from '../../src/js/operations/selected-operation-catalog.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';

test('S100g operations retain their pure unary selected signature and no duplicate public names',()=>{
  for(const op of ['median','min','max']){
    const spec=findSelectedOperationSpec(op);assert.ok(spec,op);
    assert.equal(spec.purity,'pure');
    assert.equal(spec.evaluatorId,`probe.statistics.${op}`);
    assert.deepEqual(spec.signatures[0],{arguments:[{name:'data',role:'value'}]});
    assert.equal(selectedOperationSpecs.filter(s=>s.operationId===op).length,1);
  }
});

test('S100g operation/document collisions stay explicit and task-local; lexical callees retain priority',()=>{
  for(const op of ['median','min','max']){
    const rt=DocumentRuntime.createSemantic('s100g-collision');
    for(const [id,source,taskId] of [['definition',`${op}(x):=x`,'T'],['use',`${op}({3,1,2})`,'T'],
      ['lexical',`f(${op}):=${op}(1)`,'T'],['isolated',`${op}({3,1,2})`,'U']])
      rt.addBlock({id,type:'formula',source,taskId});
    const blocks=rt.deriveSemanticTask('T').snapshot.blocks;
    const collision=blocks.find(b=>b.blockId==='use').calls[0];
    assert.equal(collision.classification,'ambiguous');
    assert.deepEqual(collision.candidates,['operation','document-writer']);
    assert.equal(blocks.find(b=>b.blockId==='lexical').calls[0].classification,'lexical-binder');
    assert.equal(rt.deriveSemanticTask('U').snapshot.blocks[0].calls[0].classification,'operation');
  }
});
