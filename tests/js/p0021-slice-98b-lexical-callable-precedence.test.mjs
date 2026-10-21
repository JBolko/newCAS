/** S98b / Claude F4: lexical callee binders must precede document writers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {analyzeSourceBlocks} from '../../src/js/semantics/analyze-source-blocks.js';
import {deriveBlockSourceBindings} from '../../src/js/semantics/derive-block-source-bindings.js';
import {classifyBlockCallTargets} from '../../src/js/semantics/classify-call-targets.js';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {LexicalIdentityScope,binderIdentity} from '../../src/js/semantics/identity.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {compileAttestedDocumentExpressionIR} from '../../src/js/semantics/compile-attested-document-expression-ir.js';

const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,
  evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const integer=n=>expression({op:'integer',value:String(n)});
const make=rows=>{
  const rt=DocumentRuntime.createSemantic('s98b');
  for(const [id,source] of rows)rt.addBlock({id,type:'formula',taskId:'T',source});
  return rt;
};
const number=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
async function run(rt,revision='r1',calls=[]) {
  const {snapshot}=rt.deriveSemanticTask('T');
  const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,
    evaluate:async(_envelope,selection)=>{
      calls.push(selection.blockId);
      const [a,b]=selection.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
      const id=selection.evaluationRequest.evaluatorId;
      return {blockId:selection.blockId,status:'success',
        value:integer(id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
    }});
  assert.equal((await rt.evaluateAndCommitSemanticTask('T',{revision,getCurrentRevision:()=>revision,evaluate})).kind,'complete');
}
function unsupported(d,name='f') {
  assert.ok(isDiagnostic(d),'must publish P0009 Diagnostic');
  assert.equal(d.code,'unsupported-operation');
  assert.deepEqual(d.parameters,{operationId:'lexical-call',name});
  return true;
}
const sources=(body,prior)=>[...(prior?[['f','f(x):=x^2']]:[]),['g',`g(f):=${body}`],['A','A:=g(100)']];

test('F4 exact Claude reproduction must never compute A=9 from document f',async()=>{
  const rt=make(sources('f(3)',true)),calls=[];
  await run(rt,'r1',calls);
  assert.notEqual(number(rt,'A'),'9','lexical f must not call the document f');
  assert.equal(rt.getBlock('g').calculation.status,'error');
  unsupported(rt.getBlock('g').calculation.error.diagnostic);
  assert.equal(rt.getBlock('A').calculation.error.code,'UPSTREAM_FAILED');
  assert.deepEqual(calls,[],'unsupported g/A never reaches arithmetic backend');
});

for(const body of ['f(3)',"f'(3)","f''(3)"]) {
  for(const prior of [false,true]) {
    test(`lexical classification and no false edge: ${body}, prior=${prior}`,()=>{
      const rt=make(sources(body,prior));
      const {snapshot,analysis}=rt.deriveSemanticTask('T');
      const g=snapshot.blocks.find(b=>b.blockId==='g');
      assert.equal(g.parseError,null);
      assert.deepEqual(g.references,[]);
      assert.equal(g.calls.length,1);
      assert.equal(g.calls[0].classification,'lexical-binder');
      assert.equal(g.calls[0].providerId,null);
      assert.deepEqual(g.calls[0].candidates,['lexical-binder']);
      assert.deepEqual(analysis.graph.getUpstream('g'),[]);
      assert.equal(analysis.bindings.get('g').size,0);
      assert.ok(snapshot.writers.some(w=>w.writerId==='g' && w.name==='g'));
      assert.equal(analysis.bindings.get('A').get('g'),'g');
    });
    test(`same structured failure independent of document f: ${body}, prior=${prior}`,async()=>{
      const rt=make(sources(body,prior));
      await run(rt);
      assert.equal(rt.getBlock('g').calculation.status,'error');
      unsupported(rt.getBlock('g').calculation.error.diagnostic);
      assert.equal(rt.getBlock('A').calculation.error.code,'UPSTREAM_FAILED');
      assert.equal(rt.getBlock('A').calculation.result,null);
    });
  }
  test(`source compiler rejects lexical callee before document callback: ${body}`,()=>{
    const scope=new LexicalIdentityScope('T').push([binderIdentity('g:param:0','f')]);
    let lookups=0;
    assert.throws(()=>compileSelectedSourceAst(parse(body),{specs,lexicalScope:scope,
      resolveCallable:()=>{lookups++;return providerReference('f');}}),error=>unsupported(error.diagnostic));
    assert.equal(lookups,0);
  });
  test(`function definition compiler retains lexical priority: ${body}`,()=>{
    let lookups=0;
    assert.throws(()=>compileSelectedFunctionDefinition(parse(`g(f):=${body}`),{
      writerId:'g',taskScopeId:'T',specs,makeBinderId:()=> 'g:param:0',
      resolveCallable:()=>{lookups++;return providerReference('f');}}),error=>unsupported(error.diagnostic));
    assert.equal(lookups,0);
  });
}

test('binding traversal distinguishes lexical calls while preserving argument reads',()=>{
  const analysis=analyzeSourceBlocks([{id:'f',source:'f(x):=x^2'},
    {id:'q',source:'q:=4'},{id:'g',source:'g(f):=f(q)+f(3)'}],parse,'T');
  const bindings=deriveBlockSourceBindings(analysis),g=bindings.blocks[2];
  assert.deepEqual(g.callTargets,[]);
  assert.deepEqual(g.lexicalCallTargets,['f']);
  assert.deepEqual(g.references.map(r=>r.name),['q']);
  assert.equal(g.references[0].binding.providerId,'q');
  const call=classifyBlockCallTargets(analysis,bindings).blocks[2].calls[0];
  assert.equal(call.classification,'lexical-binder');
  assert.equal(call.providerId,null);
  assert.ok(Object.isFrozen(g.lexicalCallTargets) && Object.isFrozen(call));
});

test('unrelated document f edits cannot invalidate or change lexical g binding',async()=>{
  const rt=make(sources('f(3)',true));
  await run(rt);
  const token=rt.getBlockSourceIdentity('g'),slot=rt.getBlock('g').calculation;
  const callsBefore=rt.deriveSemanticTask('T').snapshot.blocks.find(b=>b.blockId==='g').calls;
  rt.setBlockSource('f','f(x):=x+100');
  assert.equal(rt.getBlockSourceIdentity('g'),token);
  assert.equal(rt.getBlock('g').calculation,slot);
  assert.deepEqual(rt.deriveSemanticTask('T').snapshot.blocks.find(b=>b.blockId==='g').calls,callsBefore);
  await run(rt,'r2');
  unsupported(rt.getBlock('g').calculation.error.diagnostic);
  assert.equal(rt.getBlock('A').calculation.result,null);
});

test('failed new g remains writer; no success-dependent fallback to old g',async()=>{
  const rt=make([['f','f(x):=x^2'],['old','g(x):=x+1'],['g','g(f):=f(3)'],['A','A:=g(100)']]);
  assert.equal(rt.deriveSemanticTask('T').analysis.bindings.get('A').get('g'),'g');
  await run(rt);
  assert.equal(rt.getBlock('old').calculation.status,'success');
  unsupported(rt.getBlock('g').calculation.error.diagnostic);
  assert.equal(rt.getBlock('A').calculation.error.code,'UPSTREAM_FAILED');
  assert.equal(rt.getBlock('A').calculation.result,null);
});

test('ordinary local arithmetic still works without reading a document x',async()=>{
  const rt=make([['x','x:=99'],['g','g(x):=x^2+1'],['A','A:=g(3)']]);
  assert.deepEqual(rt.deriveSemanticTask('T').analysis.graph.getUpstream('g'),[]);
  await run(rt);assert.equal(number(rt,'A'),'10');
});

test('whitespace implicit multiplication remains distinct from callable syntax',async()=>{
  const rt=make([['f','f(x):=x^2'],['g','g(f):=f (3)'],['A','A:=g(100)']]);
  assert.equal(parse('g(f):=f (3)')[0].body.type,'BinaryExpression');
  assert.deepEqual(rt.deriveSemanticTask('T').snapshot.blocks[1].calls,[]);
  await run(rt);assert.equal(number(rt,'A'),'300');
});

test('legitimate document call, composition and immutable captures remain active',async()=>{
  const rt=make([['a','a:=2'],['f','f(x):=a*x'],['g','g(x):=f(x)+1'],
    ['later','a:=100'],['A','A:=g(3)']]);
  assert.deepEqual(rt.deriveSemanticTask('T').analysis.graph.getUpstream('g'),['f']);
  await run(rt);assert.equal(number(rt,'A'),'7');
});

test('lexical integrate shadows both an operation and a document function',async()=>{
  const rt=make([['integrate','integrate(x):=x+1'],['g','g(integrate):=integrate(3)'],['A','A:=g(100)']]);
  const g=rt.deriveSemanticTask('T').snapshot.blocks.find(b=>b.blockId==='g');
  assert.equal(g.calls[0].classification,'lexical-binder');
  assert.deepEqual(rt.deriveSemanticTask('T').analysis.graph.getUpstream('g'),[]);
  await run(rt);unsupported(rt.getBlock('g').calculation.error.diagnostic,'integrate');
});

test('lexical integrate does not introduce operation-local argument binders',()=>{
  const rt=make([['x','x:=5'],['g','g(integrate):=integrate(x,x)']]);
  const {snapshot,analysis}=rt.deriveSemanticTask('T'),g=snapshot.blocks[1];
  assert.equal(g.calls[0].classification,'lexical-binder');
  assert.deepEqual(g.references.map(r=>r.name),['x']);
  assert.equal(analysis.bindings.get('g').get('x'),'x');
});

test('source compiler checks lexical binder before selecting an OperationSpec',()=>{
  const sin=operationSpec({operationId:'sin',evaluatorId:'probe.scalar.sin',arguments:[{name:'x',role:'value'}]});
  const scope=new LexicalIdentityScope('T').push([binderIdentity('g:sin','sin')]);
  assert.throws(()=>compileSelectedSourceAst(parse('sin(3)'),{specs:new Map([['sin',sin]]),lexicalScope:scope}),
    error=>unsupported(error.diagnostic,'sin'));
});

test('local and external call occurrences of one spelling are not conflated',()=>{
  const rt=make([['f','f(x):=x^2'],['r','r:=integrate(f(3),f)+f(2)']]);
  const {snapshot,analysis}=rt.deriveSemanticTask('T'),calls=snapshot.blocks[1].calls.filter(c=>c.name==='f');
  assert.equal(calls.length,2);
  assert.ok(calls.some(c=>c.classification==='lexical-binder' && c.providerId===null));
  assert.ok(calls.some(c=>c.classification==='document-writer' && c.providerId==='f'));
  assert.equal(analysis.bindings.get('r').get('f'),'f','external occurrence remains a real dependency');
});

test('attested runtime rejects operation-local callable use without executing document f',async()=>{
  const rt=make([['f','f(x):=x^2'],['r','r:=integrate(f(3),f)+f(2)']]);
  const calls=[];await run(rt,'r1',calls);
  unsupported(rt.getBlock('r').calculation.error.diagnostic);
  assert.deepEqual(calls,[]);
});

test('attested compiler checks lexical scope even if old caller facts claim a document callee',()=>{
  const rt=make([['f','f(x):=x^2'],['r','r:=integrate(f(3),f)']]);
  const {snapshot}=rt.deriveSemanticTask('T'),original=snapshot.blocks[1];
  const entry={...original,calls:[...original.calls.filter(c=>c.classification!=='lexical-binder'),
    {name:'f',providerId:'f',classification:'document-writer',candidates:['document-writer']}]};
  assert.throws(()=>compileAttestedDocumentExpressionIR(parse('r:=integrate(f(3),f)')[0],{
    entry,blockId:'r',writers:snapshot.writers,taskScopeId:'T',makeLocalId:()=> 'local-f',
    specs:new Map([...specs,['integrate',findSelectedOperationSpec('integrate')]])}),error=>unsupported(error.diagnostic));
});
