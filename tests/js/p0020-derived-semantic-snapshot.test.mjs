import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
const lit = n=>({type:'Literal',value:n});
const variable = name=>({type:'Variable',name});
const assign=(name,value)=>[{type:'Assignment',name,value}];
const call=(name,...args)=>[{type:'FunctionCall',name,args}];
const parse = src=>{
 if(src==='INVALID') throw new SyntaxError('bad source');
 return fixtures[src];
};
const fixtures={
 first:assign('x',lit(3)),
 failed:assign('x',{type:'BinaryExpression',op:'/',left:lit(1),right:lit(0)}),
 last:assign('a',variable('x')),
 builtin:call('tangentline',variable('x'),variable('x'),lit(2)),
 colliding:assign('tangentline',lit(7)),
 function: [{type:'FunctionDefinition',name:'f',params:['t'],body:variable('t')}],
 userCall:call('f',lit(2)),
};
const b=(id,source)=>({id,source});
const run=blocks=>deriveSourceSemanticSnapshot(blocks,parse,'task1');
test('P0020 s5: a block uses nearest established writer despite mathematical failure',()=>{
 const out=run([b('one','first'),b('two','failed'),b('three','last')]);
 assert.deepEqual(out.writers.map(w=>w.writerId),['one','two','three']);
 assert.equal(out.blocks[2].references[0].binding.providerId,'two');
});
test('P0020 s5: ordinary built-in call has operation candidate',()=>{
 const out=run([b('one','builtin')]);
 assert.equal(out.blocks[0].calls[0].classification,'operation');
});
test('P0020 s5: user function resolves document writer candidate',()=>{
 const out=run([b('f0','function'),b('f1','userCall')]);
 assert.equal(out.blocks[1].calls[0].classification,'document-writer');
 assert.equal(out.blocks[1].calls[0].providerId,'f0');
});
test('P0020 s5: catalog/document name collision remains explicit ambiguity',()=>{
 const out=run([b('def','colliding'),b('use','builtin')]);
 assert.equal(out.blocks[1].calls[0].classification,'ambiguous');
 assert.deepEqual(out.blocks[1].calls[0].candidates,['operation','document-writer']);
});
test('P0020 s5: broken source never establishes a writer',()=>{
 const out=run([b('bad','INVALID'),b('x','first'),b('a','last')]);
 assert.equal(out.blocks[0].parseError,'bad source');
 assert.deepEqual(out.blocks[0].references,[]);
 assert.deepEqual(out.blocks[0].calls,[]);
 assert.equal(out.blocks[2].references[0].binding.providerId,'x');
});
test('P0020 s5: results detach snapshot identity from caller block mutations',()=>{
 const blocks=[b('x','first')];
 const out=run(blocks);
 blocks[0].id='rewritten';blocks[0].source='INVALID';
 assert.equal(out.blocks[0].blockId,'x');
 assert.equal(out.writers[0].writerId,'x');
 assert.ok(Object.isFrozen(out));assert.ok(Object.isFrozen(out.blocks));
 assert.ok(Object.isFrozen(out.blocks[0]));
});
test('P0020 s5: duplicate block identity rejected before snapshot derivation',()=>{
 assert.throws(()=>run([b('one','first'),b('one','last')]),TypeError);
});
test('P0020 s5: no document state or executable result leaks into output',()=>{
 const out=run([b('x','first')]);
 assert.deepEqual(Object.keys(out),['taskScopeId','writers','blocks']);
 assert.deepEqual(Object.keys(out.blocks[0]),['blockId','position','parseError','references','calls']);
});
