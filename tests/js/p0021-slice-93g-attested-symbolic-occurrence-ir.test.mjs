/** S93g: mandatory compile-only contract. Value execution remains deliberately unsupported. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {compileAttestedDocumentExpressionIR as compile} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {findSelectedOperationSpec,matchesSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';

const math = new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`test.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
const specs = new Map([...math, ...['integrate','tangentline','arclength'].map(id=>[id,findSelectedOperationSpec(id)])]);
const build=(sources,options={})=>{
  const blocks=sources.map((source,index)=>({id:`b${index}`,source}));
  const snapshot=deriveSourceSemanticSnapshot(blocks,parse,'s93g');
  const index=sources.length-1;
  const names=[];
  const ir=compile(parse(sources[index])[0],{
    entry:snapshot.blocks[index],blockId:`b${index}`,writers:snapshot.writers,
    specs: options.specs ?? specs,taskScopeId:'s93g',
    makeLocalId:options.makeLocalId??(({operationId,index,name})=>{
      const id=`local-${names.length}-${operationId}-${index}-${name}`;
      names.push(id);return id;
    }),
  });
  return {snapshot,ir,names};
};
const child=(node,...indices)=>indices.reduce((acc,i)=>acc.args[i],node);
const ref=(node)=>[node.kind,node.providerId??node.identity?.id??null];

test('S93g: bounded integral keeps local x separate from attested upper-bound document x',()=>{
  const {ir,snapshot,names}=build(['x:=17','integrate(x^2,x,0,x)']);
  assert.equal(snapshot.blocks[1].references.length,1);
  assert.deepEqual(snapshot.blocks[1].references.map(v=>v.name),['x']);
  assert.deepEqual(ref(child(ir,0,0)),['semantic-reference',names[0]]);
  assert.deepEqual(ref(child(ir,1)),['semantic-reference',names[0]]);
  assert.deepEqual(ref(child(ir,3)),['provider-reference','b0']);
  assert.equal(ir.callee.operationId,'integrate');
});

test('S93g: unrelated document y is attested, integrand x is symbolic',()=>{
  const {ir,names}=build(['x:=17','y:=3','integrate(x*y,x)']);
  assert.deepEqual(ref(child(ir,0,0)),['semantic-reference',names[0]]);
  assert.deepEqual(ref(child(ir,0,1)),['provider-reference','b1']);
  assert.deepEqual(ref(child(ir,1)),['semantic-reference',names[0]]);
});

test('S93g: outside +x uses provider while the integral uses operation-local x',()=>{
  const {ir,names}=build(['x:=17','integrate(x^2,x)+x']);
  assert.deepEqual(ref(child(ir,0,0,0)),['semantic-reference',names[0]]);
  assert.deepEqual(ref(child(ir,0,1)),['semantic-reference',names[0]]);
  assert.deepEqual(ref(child(ir,1)),['provider-reference','b0']);
});

test('S93g: separate nested symbolic binders are distinct and outer x is restored',()=>{
  const {ir,names}=build(['integrate(x^2+integrate(x,x),x)']);
  assert.equal(names.length,2);
  assert.notEqual(names[0],names[1]);
  assert.deepEqual(ref(child(ir,0,0,0)),['semantic-reference',names[0]]);
  assert.deepEqual(ref(child(ir,0,1,0)),['semantic-reference',names[1]]);
  assert.deepEqual(ref(child(ir,0,1,1)),['semantic-reference',names[1]]);
  assert.deepEqual(ref(child(ir,1)),['semantic-reference',names[0]]);
});

test('S93g: ordinary documents remain byte-for-byte identical without optional identity parameters',()=>{
  const sources=['x:=17','y:=x+3'];
  const {snapshot,ir}=build(sources);
  const old=compile(parse(sources[1])[0],{entry:snapshot.blocks[1],blockId:'b1',writers:snapshot.writers,specs});
  assert.equal(JSON.stringify(ir),JSON.stringify(old));
});

test('S93g: valid symbolic source requires explicit caller-owned scope and identity supplier',()=>{
  const sources=['x:=17','integrate(x^2,x)'];
  const snap=deriveSourceSemanticSnapshot(sources.map((source,i)=>({id:`b${i}`,source})),parse,'s93g');
  const args={entry:snap.blocks[1],blockId:'b1',writers:snap.writers,specs};
  assert.throws(()=>compile(parse(sources[1])[0],args),/document-owned identity supplier/);
  assert.throws(()=>compile(parse(sources[1])[0],{...args,taskScopeId:'s93g'}),/document-owned identity supplier/);
  assert.throws(()=>compile(parse(sources[1])[0],{...args,makeLocalId:()=> 'id'}),/document-owned identity supplier/);
});

test('S93g: ambiguous callable writer cannot create a symbolic identity',()=>{
  const sources=['integrate(t):=t+1','integrate(x^2,x)'];
  assert.throws(()=>build(sources),/unresolved callable|unresolved read/);
});

test('S93g: arity and malformed symbolic target are not silently downgraded',()=>{
  assert.throws(()=>build(['integrate(x^2,x,0)']),/unsupported arity|wrong-arity|unselected operation signature|unresolved read/i);
  assert.throws(()=>build(['integrate(x^2,1)']),/symbolic argument .* requires a variable|unresolved read/);
});

test('S93g: forged operation specs and unclassified selected calls fail closed',()=>{
  const fake=operationSpec({operationId:'integrate',evaluatorId:'test.unapproved',arguments:[{name:'a',role:'value'},{name:'b',role:'symbolic'}]});
  assert.throws(()=>build(['integrate(x^2,x)'],{specs:new Map([...math,['integrate',fake]])}),/unattested selected operation/);
  const sources=['integrate(x^2,x)'];
  const snap=deriveSourceSemanticSnapshot([{id:'b0',source:sources[0]}],parse,'s93g');
  const forged={...snap.blocks[0],calls:[]};
  assert.throws(()=>compile(parse(sources[0])[0],{entry:forged,blockId:'b0',specs,taskScopeId:'s93g',makeLocalId:()=> 'id'}),/unattested callable/);
});

test('S93g: duplicate operation-local identities are rejected, even for distinct calls',()=>{
  assert.throws(()=>build(['integrate(x^2,x)+integrate(y^2,y)'],{makeLocalId:()=> 'collision'}),/duplicate or invalid document-owned local identity/);
});

test('S93g: semantically equivalent reconstituted catalog spec accepted, altered role rejected',()=>{
  const catalog=findSelectedOperationSpec('integrate');
  const restored=operationSpec({operationId:catalog.operationId,evaluatorId:catalog.evaluatorId,
    signatures:catalog.signatures.map(s=>({arguments:s.arguments.map(a=>({...a}))})),
    purity:catalog.purity,diagnosticAdapterId:catalog.diagnosticAdapterId});
  assert.notEqual(restored,catalog);
  assert.equal(matchesSelectedOperationSpec(restored),true);
  const {ir}=build(['integrate(x^2,x)'],{specs:new Map([...math,['integrate',restored]])});
  assert.equal(ir.callee.operationId,'integrate');
  const changed=operationSpec({operationId:catalog.operationId,evaluatorId:catalog.evaluatorId,
    arguments:[{name:'integrand',role:'value'},{name:'variable',role:'value'}]});
  assert.equal(matchesSelectedOperationSpec(changed),false);
  assert.throws(()=>build(['integrate(x^2,x)'],{specs:new Map([...math,['integrate',changed]])}),
    /unattested selected operation/);
});
