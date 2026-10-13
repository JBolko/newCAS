import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import peggy from 'peggy';
import {analyzeSourceBlocks, resolveBlockSourceName} from '../../src/js/semantics/analyze-source-blocks.js';

const parse = peggy.generate(readFileSync('docs/Grammatik.pegjs', 'utf8')).parse;
const b=(id,source)=>({id,source});
const analyze=blocks=>analyzeSourceBlocks(blocks,parse,'task-A');

test('P0020: actual Peggy source gives a writer for x := 3',()=>{
 const a=analyze([b('x1','x := 3')]);
 assert.deepEqual(a.writers.map(w=>[w.name,w.writerId,w.position]),[['x','x1',0]]);
});
test('P0020: failed mathematics remains an established writer',()=>{
 const a=analyze([b('x1','x := 3'),b('x2','x := 1/0'),b('a','a := x')]);
 assert.equal(resolveBlockSourceName(a,'a','x').providerId,'x2');
});
test('P0020: incomplete definition is not a writer',()=>{
 const a=analyze([b('x1','x := 3'),b('invalid','x :='),b('a','a := x')]);
 assert.notEqual(a.entries[1].parseError,null);
 assert.equal(resolveBlockSourceName(a,'a','x').providerId,'x1');
});
test('P0020: a relation is not a writer',()=>{
 const a=analyze([b('relation','x = 2'),b('usage','a := x')]);
 assert.equal(resolveBlockSourceName(a,'usage','x').kind,'semantic-reference');
});
test('P0020: function definition creates a writer, not a function call',()=>{
 const a=analyze([b('f','f(x) := x^2'),b('g','g := f(2)')]);
 assert.equal(resolveBlockSourceName(a,'g','f').providerId,'f');
});
test('P0020: definition at same position cannot resolve itself',()=>{
 const a=analyze([b('x','x := x + 1')]);
 assert.equal(resolveBlockSourceName(a,'x','x').kind,'semantic-reference');
});
test('P0020: malformed multi-statement formula does not establish one writer',()=>{
 const a=analyze([b('many','x:=1; y:=2'),b('usage','a:=x')]);
 assert.equal(a.writers.some(w=>w.writerId==='many'),false);
 assert.equal(resolveBlockSourceName(a,'usage','x').kind,'semantic-reference');
});
test('P0020: source invalidation changes derived binding after reanalysis',()=>{
 const before=analyze([b('x1','x:=3'),b('x2','x:=1/0'),b('a','a:=x')]);
 const after=analyze([b('x1','x:=3'),b('x2','x:='),b('a','a:=x')]);
 assert.equal(resolveBlockSourceName(before,'a','x').providerId,'x2');
 assert.equal(resolveBlockSourceName(after,'a','x').providerId,'x1');
});
test('P0020: repeated block IDs are rejected',()=>{
 assert.throws(()=>analyze([b('id','x:=1'),b('id','y:=2')]),TypeError);
});
