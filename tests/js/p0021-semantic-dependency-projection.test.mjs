import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from '../../src/js/semantics/project-semantic-dependency-analysis.js';
import {findBlocksWithChangedBindings} from '../../src/js/document-dependency-graph.js';

const v=name=>({type:'Variable',name});
const lit=value=>({type:'Literal',value});
const a=(name,value)=>[{type:'Assignment',name,value}];
const fixtures={
 x3:a('x',lit(3)), x5:a('x',lit(5)),
 broken:a('x',{type:'BinaryExpression',op:'/',left:lit(1),right:lit(0)}),
 useX:a('y',v('x')), other:a('z',v('unknown')),
 f:[{type:'FunctionDefinition',name:'f',params:['t'],body:v('t')}],
};
const parse=key=>{
 if(key==='INVALID') throw new SyntaxError('invalid source');
 return fixtures[key];
};
const b=(id,source)=>({id,source});
function project(blocks) {return projectSemanticDependencyAnalysis(deriveSourceSemanticSnapshot(blocks,parse,'task1'));}

test('P0021 s1: graph uses exactly the same nearest provider as semantic binding',()=>{
 const analysis=project([b('w1','x3'),b('use1','useX'),b('w2','x5'),b('use2','useX')]);
 assert.equal(analysis.bindings.get('use1').get('x'),'w1');
 assert.equal(analysis.bindings.get('use2').get('x'),'w2');
 assert.ok(analysis.graph.hasEdge('w1','use1'));
 assert.ok(analysis.graph.hasEdge('w2','use2'));
 assert.equal(analysis.graph.hasEdge('w1','use2'),false);
});
test('P0021 s1: mathematically failed writer is still authoritative provider',()=>{
 const analysis=project([b('first','x3'),b('broken','broken'),b('after','useX')]);
 assert.equal(analysis.bindings.get('after').get('x'),'broken');
 assert.ok(analysis.graph.hasEdge('broken','after'));
 assert.ok(!analysis.graph.hasEdge('first','after'));
});
test('P0021 s1: unresolved source name creates no provider edge',()=>{
 const analysis=project([b('missing','other')]);
 assert.deepEqual([...analysis.bindings.get('missing')],[]);
 assert.deepEqual(analysis.graph.getUpstream('missing'),[]);
});
test('P0021 s1: invalid source participates as node with no reads',()=>{
 const analysis=project([b('bad','INVALID'),b('writer','x3'),b('use','useX')]);
 assert.deepEqual(analysis.graph.getUpstream('bad'),[]);
 assert.ok(analysis.graph.hasEdge('writer','use'));
});
test('P0021 s1: binder-local function parameter is not a provider dependency',()=>{
 const analysis=project([b('f0','f')]);
 assert.deepEqual([...analysis.bindings.get('f0')],[]);
});
test('P0021 s1: provider switch is visible to existing change detector',()=>{
 const before=project([b('w1','x3'),b('use','useX'),b('w2','x5')]);
 const after=project([b('w1','x3'),b('w2','x5'),b('use','useX')]);
 const oldMap=new Map([['task1',before]]);
 const newMap=new Map([['task1',after]]);
 assert.deepEqual(findBlocksWithChangedBindings(oldMap,newMap),new Set(['use']));
});
test('P0021 s1: duplicate and dangling identities are contract failures',()=>{
 const snapshot=deriveSourceSemanticSnapshot([b('w1','x3'),b('use','useX')],parse,'task1');
 assert.throws(()=>projectSemanticDependencyAnalysis({...snapshot,blocks:[snapshot.blocks[0],snapshot.blocks[0]]}),TypeError);
 const forged={...snapshot,blocks:[snapshot.blocks[0],{...snapshot.blocks[1],references:[{name:'x',binding:{kind:'provider-reference',providerId:'missing'}}]}]};
 assert.throws(()=>projectSemanticDependencyAnalysis(forged),TypeError);
});
test('P0021 s1: projection does not mutate the original semantic snapshot',()=>{
 const snapshot=deriveSourceSemanticSnapshot([b('w','x3'),b('u','useX')],parse,'task1');
 const serialized=JSON.stringify(snapshot);
 const analysis=projectSemanticDependencyAnalysis(snapshot);
 analysis.bindings.get('u').set('x','changed-local-copy');
 assert.equal(JSON.stringify(snapshot),serialized);
 assert.equal(snapshot.blocks[1].references[0].binding.providerId,'w');
});
