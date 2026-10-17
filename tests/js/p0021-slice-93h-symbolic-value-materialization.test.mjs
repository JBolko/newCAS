/** S93h: selected, attested symbolic IR -> immutable P0005 Value arguments.
 * This tests VALUE MATERIALIZATION, not integration through the Worker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {compileAttestedDocumentExpressionIR} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {materializeSelectedSymbolicArguments as materialize} from '../../src/js/semantics/materialize-selected-symbolic-arguments.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {freeSymbolIdentity} from '../../src/js/semantics/identity.js';
import {call, operationReference, providerReference, semanticReference, valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {expression, isValue} from '../../src/js/values/value.js';

const iv = n => expression({op:'integer',value:String(n)});
const math = new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`test.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
const specs = new Map([...math, ...['integrate','tangentline'].map(id=>[id,findSelectedOperationSpec(id)])]);
const env = (source,blockId,providers=[]) => ({protocol:'newcas.semantic-evaluation.v1',
  revision:'rev-93h',blockId,taskScopeId:'scope-93h',source,providers});
const compiled = (sources, providerValues = {}) => {
  const blocks = sources.map((source,i)=>({id:`b${i}`,source}));
  const snapshot = deriveSourceSemanticSnapshot(blocks,parse,'scope-93h');
  const i=sources.length-1,source=sources[i],blockId=`b${i}`;
  let occurrence=0;
  const ir=compileAttestedDocumentExpressionIR(parse(source)[0],{
    entry:snapshot.blocks[i],blockId,writers:snapshot.writers,specs,
    taskScopeId:'scope-93h',
    makeLocalId:({operationId,index,name})=>`b${i}:local:${occurrence++}:${operationId}:${index}:${name}`,
  });
  const providers=snapshot.blocks[i].references.map(r=>({name:r.name,
    providerId:r.binding.providerId,value:providerValues[r.name]}));
  return {ir,snapshot,envelope:env(source,blockId,providers)};
};
const first = result => result.inputs[0].data.expr;

test('S93h: bound integral emits operation-local symbol and attested upper-bound Value',()=>{
  const {ir,envelope}=compiled(['x:=17','integrate(x^2,x,0,x)'],{x:iv(17)});
  const result=materialize(envelope,ir,specs.get('integrate'));
  assert.equal(result.inputs.length,4);
  assert.deepEqual(result.inputs.map(v=>v.kind),Array(4).fill('expression'));
  assert.equal(first(result).op,'pow');
  const local=first(result).base.identity;
  assert.equal(local.kind,'operation-local');
  assert.deepEqual(result.inputs[1].data.expr.identity,local);
  assert.deepEqual(result.inputs[2].data.expr,{op:'integer',value:'0'});
  assert.deepEqual(result.inputs[3].data.expr,{op:'integer',value:'17'});
  assert.deepEqual(result.providerIds,[{name:'x',providerId:'b0'}]);
  assert.ok(result.inputs.every(isValue));
  assert.ok(Object.isFrozen(result.inputs) && Object.isFrozen(result));
});

test('S93h: unrelated attested document y is substituted without rebinding local x',()=>{
  const {ir,envelope}=compiled(['x:=17','y:=3','integrate(x*y,x)'],{y:iv(3)});
  const result=materialize(envelope,ir,specs.get('integrate'));
  assert.deepEqual(first(result).args[1],{op:'integer',value:'3'});
  assert.deepEqual(first(result).args[0].identity,result.inputs[1].data.expr.identity);
  assert.deepEqual(result.providerIds,[{name:'y',providerId:'b1'}]);
});

test('S93h: selected tangentline materializes local symbol and separate point',()=>{
  const {ir,envelope}=compiled(['x:=17','tangentline(x^2,x,2)']);
  const result=materialize(envelope,ir,specs.get('tangentline'));
  assert.deepEqual(first(result).base.identity,result.inputs[1].data.expr.identity);
  assert.deepEqual(result.inputs[2],iv(2));
  assert.equal(result.providerIds.length,0);
});

test('S93h: materialization never mutates providers, attested IR or their identities',()=>{
  const {ir,envelope}=compiled(['y:=3','integrate(x*y,x)'],{y:iv(3)});
  const oldIr=JSON.stringify(ir),oldEnv=JSON.stringify(envelope);
  const result=materialize(envelope,ir,specs.get('integrate'));
  assert.equal(JSON.stringify(ir),oldIr);
  assert.equal(JSON.stringify(envelope),oldEnv);
  assert.ok(Object.isFrozen(result.inputs[0].data.expr));
});

test('S93h: unknown, unused and duplicate providers fail closed',()=>{
  const {ir,envelope}=compiled(['y:=3','integrate(x*y,x)'],{y:iv(3)});
  const spec=specs.get('integrate');
  assert.throws(()=>materialize({...envelope,providers:[]},ir,spec),/missing expression provider/);
  assert.throws(()=>materialize({...envelope,providers:[...envelope.providers,{name:'z',providerId:'b-z',value:iv(4)}]},ir,spec),/unused provider/);
  assert.throws(()=>materialize({...envelope,providers:[...envelope.providers,...envelope.providers]},ir,spec),/invalid provider/);
  assert.throws(()=>materialize({...envelope,providers:[{name:'y',providerId:'b1',value:{kind:'expression'}}]},ir,spec),/invalid provider/);
});

test('S93h: symbolic target requires SemanticIdentity, never an ordinary provider Value',()=>{
  const ref=semanticReference(freeSymbolIdentity('scope-93h','x'));
  const operation=specs.get('integrate');
  const ir=call(operationReference('integrate'),[ref,providerReference('b0')]);
  assert.throws(()=>materialize(env('integrate(x,x)','b1',[{name:'x',providerId:'b0',value:iv(17)}]),ir,operation),/explicit identity/);
});

test('S93h: unsupported symbolic call nesting cannot become Value by falling back to raw source',()=>{
  const ref=semanticReference(freeSymbolIdentity('scope-93h','x'));
  const nested=call(operationReference('execute'),[ref]);
  const ir=call(operationReference('integrate'),[nested,ref]);
  assert.throws(()=>materialize(env('integrate(execute(x),x)','b1'),ir,specs.get('integrate')),
    /unsupported symbolic expression/);
});

test('S93h: wrong operation, arity and non-symbolic specs are rejected',()=>{
  const ref=semanticReference(freeSymbolIdentity('scope-93h','x'));
  const ir=call(operationReference('integrate'),[ref,ref]);
  assert.throws(()=>materialize(env('integrate(x,x)','b1'),ir,specs.get('tangentline')),/selected operation mismatch/);
  const wrong=call(operationReference('integrate'),[ref]);
  assert.throws(()=>materialize(env('integrate(x)','b1'),wrong,specs.get('integrate')),/symbolic\/value argument roles/);
  const plain=call(operationReference('add'),[ref,valueLiteral(iv(1))]);
  assert.throws(()=>materialize(env('add(x,1)','b1'),plain,specs.get('add')),/symbolic\/value argument roles/);
});

test('S93h: no ordinary DocumentRuntime symbolic operation is silently activated',async()=>{
  // The existing evaluator intentionally rejects semantic-reference until a
  // separate selected transport/evaluation and attestation contract is reviewed.
  const {evaluateAttestedDocumentIR}=await import('../../src/js/semantics/evaluate-attested-document-ir.js');
  const {ir,envelope}=compiled(['integrate(x^2,x)']);
  let calls=0;
  await assert.rejects(()=>evaluateAttestedDocumentIR({ir,envelope,specs,
    evaluate:async()=>{calls++;throw Error('must not call Worker');},
    applyFunction:async()=>{calls++;throw Error('must not call function');},
  }),/unsupported IR node semantic-reference/);
  assert.equal(calls,0);
});
