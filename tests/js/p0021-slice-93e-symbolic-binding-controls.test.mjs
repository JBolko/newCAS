/** S93e GREEN controls: operation roles belong to P0008/P0019, while
 * unrelated lexical/document bindings continue to work as before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {planOperationArguments} from '../../src/js/semantics/operation-argument-plan.js';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';

function snapshot(...sources){return deriveSourceSemanticSnapshot(sources.map((source,i)=>({id:`block-${i}`,source})),parse,'s93e-task');}
const refs = (s,i) => s.blocks[i].references.map(x=>[x.name,x.binding.kind,x.binding.providerId ?? null]);

test('S93e control: operation plans declare symbolic targets without document lookup',()=>{
  for(const [name,arity,index] of [['integrate',2,1],['integrate',4,1],['tangentline',3,1],['arclength',4,1]]){
    const spec=findSelectedOperationSpec(name);
    const plan=planOperationArguments(spec,arity);
    assert.equal(plan.status,'selected');
    assert.equal(plan.arguments[index].role,'symbolic');
    assert.ok(Object.isFrozen(plan.arguments));
  }
});

test('S93e control: ordinary document arithmetic still resolves prior x',()=>{
  const s=snapshot('x:=17','r:=x+1');
  assert.deepEqual(refs(s,1),[['x','provider-reference','block-0']]);
});

test('S93e control: lexical function binder does not capture a prior document x',()=>{
  const s=snapshot('x:=17','f(x):=x^2');
  assert.deepEqual(refs(s,1),[]);
});

test('S93e control: unsupported call must not invent local symbolic scope',()=>{
  const s=snapshot('x:=17','unknown(x)');
  assert.deepEqual(refs(s,1),[['x','provider-reference','block-0']]);
  assert.equal(s.blocks[1].calls[0].classification,'unresolved');
});
