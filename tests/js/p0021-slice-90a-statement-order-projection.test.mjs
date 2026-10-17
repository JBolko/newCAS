/** Slice 90a: proposed multi-statement positions, not active runtime dispatch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../../src/js/parser.mjs';
import { DocumentRuntime } from '../../src/js/document-runtime.js';
import { deriveSequentialSourceSemanticSnapshot } from '../../src/js/semantics/analyze-sequential-source-blocks.js';
import { projectSemanticDependencyAnalysis } from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import { orderSemanticRecomputation } from '../../src/js/semantics/order-semantic-recomputation.js';

const b = (id, source) => ({id, source});
const analyse = (blocks, scope='task-1') => deriveSequentialSourceSemanticSnapshot(blocks, parse, scope);
const id = (parent, ordinal) => JSON.stringify([parent, ordinal]);
const bindings = result => projectSemanticDependencyAnalysis(result.snapshot).bindings;

test('S90a: semicolon preserves left-to-right semantic statement order', () => {
  const out = analyse([b('one', 'a:=1; b:=a+2; a:=5; resultat:=a b')]);
  const bind = bindings(out);
  assert.deepEqual(out.positions.map(p => [p.parentBlockId,p.statementIndex,p.position]),
    [['one',0,0],['one',1,1],['one',2,2],['one',3,3]]);
  assert.equal(bind.get(id('one',1)).get('a'), id('one',0));
  assert.equal(bind.get(id('one',3)).get('a'), id('one',2));
  assert.equal(bind.get(id('one',3)).get('b'), id('one',1));
  assert.equal(out.analysis.entries[3].ast[0].value.type, 'BinaryExpression');
  assert.equal(out.analysis.entries[3].ast[0].value.op, '*');
});

test('S90a: statement order continues across parent blocks; no self-edge', () => {
  const out=analyse([b('first','a:=2'),b('middle','a:=a+3; b:=a'),b('last','c:=a+b')]);
  const projected=projectSemanticDependencyAnalysis(out.snapshot);
  assert.equal(projected.bindings.get(id('middle',0)).get('a'),id('first',0));
  assert.equal(projected.bindings.get(id('middle',1)).get('a'),id('middle',0));
  assert.equal(projected.bindings.get(id('last',0)).get('a'),id('middle',0));
  assert.equal(projected.bindings.get(id('last',0)).get('b'),id('middle',1));
  assert.equal(projected.graph.hasEdge(id('middle',0),id('middle',0)),false);
});

test('S90a: existing semantic graph orders derived statements without another scheduler', () => {
  const out=analyse([b('one','a:=1; b:=a+2; c:=b*a')]);
  const projected=projectSemanticDependencyAnalysis(out.snapshot);
  const plan={recompute:new Set(out.positions.map(p=>p.statementId)),removed:new Set()};
  const schedule=orderSemanticRecomputation(projected,plan);
  assert.deepEqual(schedule.order,[id('one',0),id('one',1),id('one',2)]);
  assert.deepEqual(schedule.cycles,[]);
});

test('S90a: canonical parser distinguishes nested argument/list separators from statements', () => {
  const out=analyse([b('one','v := [1;2;3]; r := sum(1;2); k := {4;5}')]);
  assert.equal(out.positions.length,3);
  assert.equal(out.analysis.entries[0].ast[0].value.type,'Vector');
  assert.equal(out.analysis.entries[1].ast[0].value.type,'FunctionCall');
  assert.equal(out.analysis.entries[2].ast[0].value.type,'List');
});

test('S90a: failed mathematical writer is still nearest provider, not a fallback',()=>{
  const out=analyse([b('one','a:=1; a:=1/0; b:=a')]);
  assert.equal(bindings(out).get(id('one',2)).get('a'),id('one',1));
});

test('S90a: expression statement occupies position but establishes no writer',()=>{
  const out=analyse([b('one','a:=2; a; b:=a')]);
  assert.deepEqual(out.snapshot.writers.map(w=>w.name),['a','b']);
  assert.equal(bindings(out).get(id('one',1)).get('a'),id('one',0));
  assert.equal(bindings(out).get(id('one',2)).get('a'),id('one',0));
});

test('S90a: any incomplete source suppresses every writer in that parent block', () => {
  const out=analyse([b('first','a:=7'),b('bad','a:=1; b:='),b('use','c:=a+1')]);
  assert.equal(out.analysis.entries.length,3);
  assert.deepEqual(out.analysis.entries.filter(e=>e.parentBlockId==='bad').map(e=>e.parseError!==null),[true]);
  assert.deepEqual(out.snapshot.writers.map(w=>w.name),['a','c']);
  assert.equal(bindings(out).get(id('use',0)).get('a'),id('first',0));
});

test('S90a: malformed parser output fails closed at the whole-parent boundary', () => {
  const out=deriveSequentialSourceSemanticSnapshot([b('broken','anything')],
    ()=>[{type:'Assignment',name:'a',value:{type:'Literal',value:1}},null],'task');
  assert.equal(out.analysis.writers.length,0);
  assert.ok(out.snapshot.blocks[0].parseError);
});

test('S90a: function parameter remains lexical; later function call binds earlier writer', () => {
  const out=analyse([b('one','a:=2; f(x):=a*x; g:=f(3)')]);
  const bind=bindings(out);
  assert.equal(bind.get(id('one',1)).get('a'),id('one',0));
  assert.equal(bind.get(id('one',1)).has('x'),false);
  assert.equal(out.snapshot.blocks[2].calls[0].providerId,id('one',1));
});

test('S90a: one task cannot resolve a writer from another task',()=>{
  const first=analyse([b('first','a:=3')],'task-one');
  const second=analyse([b('second','b:=a')],'task-two');
  assert.equal(first.snapshot.writers[0].taskScopeId,'task-one');
  assert.equal(second.snapshot.blocks[0].references[0].binding.kind,'semantic-reference');
});

test('S90a: virtual statement identities cannot collide for arbitrary parent IDs',()=>{
  const out=analyse([b('x,0','a:=1'),b('x','a:=2; b:=a'),b('["x",0]','c:=1')]);
  assert.equal(new Set(out.positions.map(p=>p.statementId)).size,4);
});

test('S90a: no document mutation, compiler, worker or legacy engine imported',()=>{
  const source=readFileSync(new URL('../../src/js/semantics/analyze-sequential-source-blocks.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:eval|exec)\s*\(/);
  assert.doesNotMatch(source,/(?:cas-engine|transformer|document-runtime|src\/python|worker-evaluation)/i);
  const inputs=[b('a','a:=1; b:=2')];
  const out=analyse(inputs);
  assert.equal(inputs[0].source,'a:=1; b:=2');
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(out.positions));
  assert.ok(Object.isFrozen(out.positions[0]));
});

// Deliberately RED when enabled: S90a has NOT migrated the active document
// batch/commit path. TODO in normal regression, NEVER reported as passing.
const activeGate=process.env.NEWCAS_S90_REQUIRE_ACTIVE==='1' ? test : test.todo;
activeGate('S90 pending: active DocumentRuntime evaluates sequential statements as one block',()=>{
  const legacy={calculate(){throw Error('legacy must not be used')},getTaskState(){throw Error('legacy must not be used')}};
  const rt=new DocumentRuntime(legacy,'doc');
  rt.addBlock({id:'multi',type:'formula',source:'a:=1; b:=3; resultat:=a b'});
  const actual=rt.deriveSemanticTask();
  assert.equal(actual.snapshot.blocks[0].parseError,null,
    'Slice 90b+ must integrate statement positions with runtime-owned results');
});
