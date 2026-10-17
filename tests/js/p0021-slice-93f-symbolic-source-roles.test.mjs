/** S93f: selected symbolic source occurrences do not become document dependencies.
 * These are mandatory source-analysis tests, NOT proof of an IR/Worker Value.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {planSourceOccurrenceRoles,UnsupportedSourceOperationRole} from '../../src/js/semantics/plan-source-occurrence-roles.js';

const snapshot = (...sources) => deriveSourceSemanticSnapshot(
  sources.map((source,i) => ({id:`b${i}`,source})),parse,'s93f');
const refs = (s,i) => s.blocks[i].references.map(r=>[r.name,r.binding.kind,r.binding.providerId ?? null]);
const provider = (name,id) => [name,'provider-reference',`b${id}`];

test('S93f: bounded integration uses document x in upper bound, not integrand',()=>{
  const s=snapshot('x:=17','integrate(x^2,x,0,x)');
  assert.deepEqual(refs(s,1),[provider('x',0)]);
});

test('S93f: unrelated document y and upper-bound x are still document reads',()=>{
  const s=snapshot('x:=17','y:=3','integrate(x*y,x,0,x)');
  assert.deepEqual(refs(s,2),[provider('y',1),provider('x',0)]);
});

test('S93f: ordinary x outside symbolic operation remains a document read',()=>{
  const s=snapshot('x:=17','integrate(x^2,x)+x');
  assert.deepEqual(refs(s,1),[provider('x',0)]);
});

test('S93f: nested operation scopes only their own source arguments',()=>{
  const s=snapshot('x:=17','y:=3','integrate(x*y+integrate(x^2,x),x)');
  assert.deepEqual(refs(s,2),[provider('y',1)]);
  assert.deepEqual(s.blocks[2].calls.map(c=>c.name),['integrate']); // current snapshot reports unique call names
});

test('S93f: wrong arity cannot establish a symbolic local scope',()=>{
  const s=snapshot('x:=17','integrate(x^2,x,0)');
  assert.deepEqual(refs(s,1),[provider('x',0)]);
});

test('S93f: non-variable symbolic target cannot establish a local scope',()=>{
  const s=snapshot('x:=17','integrate(x^2, 1)');
  assert.deepEqual(refs(s,1),[provider('x',0)]);
  assert.throws(()=>planSourceOccurrenceRoles(parse('integrate(x^2, 1)')[0],findSelectedOperationSpec('integrate')),UnsupportedSourceOperationRole);
});

test('S93f: name collision with an earlier callable writer is ambiguous, not bound locally',()=>{
  const s=snapshot('x:=17','integrate(t):=t+1','integrate(x^2,x)');
  assert.deepEqual(refs(s,2),[provider('x',0)]);
  assert.equal(s.blocks[2].calls[0].classification,'ambiguous');
});

test('S93f: canonical role plan distinguishes symbolic x from bounded upper x',()=>{
  const ast=parse('integrate(x^2,x,0,x)')[0];
  const roles=planSourceOccurrenceRoles(ast,findSelectedOperationSpec('integrate'));
  assert.equal(roles.status,'selected');
  assert.deepEqual(roles.occurrences.map(v=>v.governedBy),[['x'],[],[],[]]);
  assert.deepEqual(roles.occurrences.map(v=>v.role),['value','symbolic','value','value']);
  assert.ok(Object.isFrozen(roles.occurrences));
});

test('S93f: symbolic target scopes earlier source, not later value',()=>{
  const s=snapshot('x:=17','tangentline(x^2,x,x)');
  assert.deepEqual(refs(s,1),[provider('x',0)]);
});

test('S93f: lexical parameter is still local in a function body',()=>{
  const s=snapshot('x:=17','f(x):=integrate(x^2,x)+x');
  assert.deepEqual(refs(s,1),[]);
});
