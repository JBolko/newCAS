import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import peggy from 'peggy';
import {analyzeSourceBlocks} from '../../src/js/semantics/analyze-source-blocks.js';
import {deriveBlockSourceBindings} from '../../src/js/semantics/derive-block-source-bindings.js';
const parse=peggy.generate(readFileSync('docs/Grammatik.pegjs','utf8')).parse;
const b=(id,source)=>({id,source});
const derive=blocks=>deriveBlockSourceBindings(analyzeSourceBlocks(blocks,parse,'task-A'));
const ref=(analysis,id,name)=>analysis.blocks.find(b=>b.blockId===id).references.find(r=>r.name===name)?.binding;

test('P0020/3: RHS binds nearest preceding writer from real source',()=>{
 const a=derive([b('x1','x:=3'),b('x2','x:=5'),b('y','y:=x^2')]);
 assert.equal(ref(a,'y','x').providerId,'x2');
});
test('P0020/3: failed mathematical RHS still establishes nearest writer',()=>{
 const a=derive([b('x1','x:=3'),b('x2','x:=1/0'),b('y','y:=x')]);
 assert.equal(ref(a,'y','x').providerId,'x2');
});
test('P0020/3: invalid source cannot establish writer or contribute reads',()=>{
 const a=derive([b('x1','x:=3'),b('bad','x:='),b('y','y:=x')]);
 assert.equal(ref(a,'y','x').providerId,'x1');
 assert.ok(a.blocks[1].parseError); assert.deepEqual(a.blocks[1].references,[]);
});
test('P0020/3: definition does not read its own LHS',()=>{
 const a=derive([b('x','x:=x+1')]);
 assert.equal(ref(a,'x','x').kind,'semantic-reference');
 assert.deepEqual(a.blocks[0].references.map(r=>r.name),['x']);
});
test('P0020/3: function parameters are local, not document reads',()=>{
 const a=derive([b('external','a:=3'),b('fun','f(x):=x^2+a')]);
 assert.deepEqual(a.blocks[1].references.map(r=>r.name),['a']);
 assert.equal(ref(a,'fun','a').providerId,'external');
});
test('P0020/3: calls are not silently mistaken for variable reads',()=>{
 const a=derive([b('a','a:=2'),b('b','b:=sin(a)+cos(a)')]);
 assert.deepEqual(a.blocks[1].references.map(r=>r.name),['a']);
 assert.deepEqual(a.blocks[1].callTargets,['sin','cos']);
});
test('P0020/3: no retroactive provider from a future writer',()=>{
 const a=derive([b('y','y:=z'),b('z','z:=3')]);
 assert.equal(ref(a,'y','z').kind,'semantic-reference');
});
test('P0020/3: duplicates deduplicated, original read order retained',()=>{
 const a=derive([b('f','a:=x+x+y+x')]);
 assert.deepEqual(a.blocks[0].references.map(r=>r.name),['x','y']);
});
test('P0020/3: metadata is frozen and immutable',()=>{
 const a=derive([b('x','x:=3'),b('y','y:=x')]);
 assert.ok(Object.isFrozen(a));assert.ok(Object.isFrozen(a.blocks));
 assert.ok(Object.isFrozen(a.blocks[1].references[0]));
});
