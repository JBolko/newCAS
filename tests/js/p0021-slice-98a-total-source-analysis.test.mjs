/** S98a / F1a: canonical parseable source must not poison document editing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {analyzeDependencies} from '../../src/js/dependency-analyzer.js';
import {analyzeSourceBlocks} from '../../src/js/semantics/analyze-source-blocks.js';
import {deriveBlockSourceBindings} from '../../src/js/semantics/derive-block-source-bindings.js';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';

const broken = [
  ['a := 5 -> [m]', 'Assignment'],
  ['f(x) := x+1 -> [m]', 'FunctionDefinition'],
  ['a := missing+sin(q) -> [m]', 'Assignment'],
  ['f(x) := x+outside+sin(q) -> [m]', 'FunctionDefinition'],
];
const add = (rt,id,source,taskId='A') => rt.addBlock({id,type:'formula',source,taskId});
const integer = n => expression({op:'integer',value:String(n)});
const specs = new Map([['add',operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]]);
async function run(rt,taskId='A',revision='r1') {
  const {snapshot} = rt.deriveSemanticTask(taskId);
  const evaluate = createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,
    evaluate:async (_envelope,selected) => {
      assert.equal(selected.evaluationRequest.evaluatorId,'probe.scalar.add');
      const [a,b] = selected.evaluationRequest.inputs;
      return {blockId:selected.blockId,status:'success',
        value:integer(BigInt(a.data.expr.value)+BigInt(b.data.expr.value))};
    }});
  return rt.evaluateAndCommitSemanticTask(taskId,{revision,getCurrentRevision:()=>revision,evaluate});
}
const value = (rt,id) => rt.getBlock(id).calculation.result?.data?.expr?.value;

for (const [source,innerType] of broken) {
  test(`F1a exact AST and total bindings: ${source}`,()=>{
    const ast = parse(source);
    assert.equal(ast[0].type,'Conversion');
    assert.equal(ast[0].expr.type,innerType);
    const input = [{id:'bad',source},{id:'good',source:'b:=2'}];
    const analysis = analyzeSourceBlocks(input,parse,'A');
    assert.equal(analysis.entries[0].parseError,null); // unsupported is not syntax-invalid
    assert.deepEqual(analysis.writers.map(w=>w.writerId),['good']);
    const bindings = deriveBlockSourceBindings(analysis);
    assert.deepEqual(bindings.blocks[0].references,[]);
    assert.deepEqual(bindings.blocks[0].callTargets,[]);
    assert.equal(input[0].source,source);
  });

  test(`F1a no nested legacy graph writer/read: ${source}`,()=>{
    assert.deepEqual(analyzeDependencies(parse(source)),{reads:[],writes:[]});
  });

  test(`F1a local structured failure, later valid blocks evaluate: ${source}`,async()=>{
    const rt = DocumentRuntime.createSemantic('f1a');
    add(rt,'first','a:=4'); add(rt,'bad',source); add(rt,'use','b:=a+1');
    const {snapshot,analysis} = rt.deriveSemanticTask('A');
    assert.deepEqual(snapshot.writers.map(w=>w.writerId),['first','use']);
    assert.deepEqual(analysis.graph.getUpstream('bad'),[]);
    assert.equal(analysis.bindings.get('use').get('a'),'first');
    assert.deepEqual(rt.getBlock('bad').dependencies,{reads:[],writes:[]});
    assert.equal((await run(rt)).kind,'complete');
    const failed = rt.getBlock('bad');
    assert.equal(failed.source,source);
    assert.equal(failed.calculation.status,'error');
    assert.equal(failed.calculation.result,null);
    assert.equal(failed.calculation.error.code,'unsupported-operation');
    assert.ok(isDiagnostic(failed.calculation.error.diagnostic));
    assert.deepEqual(failed.calculation.error.diagnostic.parameters,{operationId:'conversion'});
    assert.equal(value(rt,'use'),'5');
  });
}

// All canonical statement/expression node families, including ordinary conversions.
const forms = [
  ['a:=q+1','Assignment',['q'],['a']],
  ['f(x):=x+q','FunctionDefinition',['q'],['f']],
  ['q=2','Equation',['q'],[]],
  ['q+1','BinaryExpression',['q'],[]],
  ['-q','UnaryExpression',['q'],[]],
  ['q^2','PowerExpression',['q'],[]],
  ['sin(q)','FunctionCall',['q'],[]],
  ["f'(q)",'Derivative',['q'],[]],
  ['q','Variable',['q'],[]],
  ['2','Literal',[],[]],
  ['2[m]','Quantity',[],[]],
  ['{q;2}','List',['q'],[]],
  ['[q;2]','Vector',['q'],[]],
  ['v[q]','Access',['v','q'],[]],
  ['q -> [m]','Conversion',['q'],[]],
  ['q=2 -> [m]','Conversion',['q'],[]],
  ['36[km/h] -> [m/s]','Conversion',[],[]],
];
for (const [source,type,reads,writes] of forms) {
  test(`canonical ${type} remains analyzable: ${source}`,()=>{
    assert.equal(parse(source)[0].type,type);
    const snapshot = deriveSourceSemanticSnapshot([{id:'b',source}],parse,'A');
    assert.equal(snapshot.blocks[0].parseError,null);
    assert.deepEqual(snapshot.blocks[0].references.map(r=>r.name),reads);
    assert.deepEqual(snapshot.writers.map(w=>w.name),writes);
    const rt = DocumentRuntime.createSemantic('forms');
    add(rt,'b',source);
    rt.setBlockSource('b',source);
    assert.equal(rt.getBlock('b').source,source);
    assert.equal(rt.deriveSemanticTask('A').snapshot.blocks[0].parseError,null);
    if (type === 'Conversion') {
      assert.deepEqual(analyzeDependencies(parse(source)),{reads:[...reads].sort(),writes:[]});
    }
  });
}

test('F1a source edits in both tasks survive an unsupported source in task A',async()=>{
  const rt = DocumentRuntime.createSemantic('isolated');
  add(rt,'bad','a:=5 -> [m]');
  add(rt,'a','a:=8','B'); add(rt,'use','b:=a+1','B');
  assert.equal((await run(rt,'B')).kind,'complete');
  assert.equal(value(rt,'use'),'9');
  const badIdentity = rt.getBlockSourceIdentity('bad');
  const badGeneration = rt.getBlock('bad').calculation.generation;
  rt.setBlockSource('a','a:=10'); // used to throw while capturing task A analyses
  assert.equal((await run(rt,'B','r2')).kind,'complete');
  assert.equal(value(rt,'use'),'11');
  assert.equal(rt.getBlockSourceIdentity('bad'),badIdentity);
  assert.equal(rt.getBlock('bad').calculation.generation,badGeneration);
  const bIdentity = rt.getBlockSourceIdentity('a');
  const bResult = rt.getBlock('use').calculation.result;
  rt.setBlockSource('bad','f(x):=x+1 -> [m]');
  assert.equal((await run(rt,'A','r3')).kind,'complete');
  assert.equal(rt.getBlock('bad').calculation.error.code,'unsupported-operation');
  assert.equal(rt.getBlockSourceIdentity('a'),bIdentity);
  assert.equal(rt.getBlock('use').calculation.result,bResult);
  assert.deepEqual(rt.deriveSemanticTask('A').snapshot.writers,[]);
  assert.deepEqual(rt.deriveSemanticTask('B').analysis.graph.getUpstream('use'),['a']);
});

test('F1a reconstruct authoritative sources through public APIs without calculation state',async()=>{
  const original = DocumentRuntime.createSemantic('original');
  add(original,'bad','f(x):=x+1 -> [m]');
  add(original,'a','a:=3'); add(original,'use','b:=a+1');
  add(original,'other','a:=9','B');
  const data = original.getBlocks().map(({id,type,source,taskId})=>({id,type,source,taskId}));
  const restored = DocumentRuntime.createSemantic('restored');
  for (const block of JSON.parse(JSON.stringify(data))) restored.addBlock(block);
  assert.deepEqual(restored.getBlocks().map(({id,type,source,taskId})=>({id,type,source,taskId})),data);
  assert.equal((await run(restored)).kind,'complete');
  assert.equal(value(restored,'use'),'4');
  assert.equal(restored.getBlock('bad').calculation.error.code,'unsupported-operation');
  restored.setBlockSource('a','a:=6');
  assert.equal((await run(restored,'A','r2')).kind,'complete');
  assert.equal(value(restored,'use'),'7');
  assert.equal(original.getBlock('a').source,'a:=3');
  assert.equal(restored.getBlock('other').calculation.status,'idle');
});

test('F1a unsupported real writer still shadows earlier success, without fallback',async()=>{
  const rt = DocumentRuntime.createSemantic('no-fallback');
  add(rt,'old','a:=4'); add(rt,'new','a:={1;2}'); add(rt,'use','b:=a+1');
  assert.equal(rt.deriveSemanticTask('A').analysis.bindings.get('use').get('a'),'new');
  assert.equal((await run(rt)).kind,'complete');
  assert.equal(value(rt,'old'),'4');
  assert.equal(rt.getBlock('new').calculation.status,'error');
  assert.equal(rt.getBlock('use').calculation.error.code,'UPSTREAM_FAILED');
  assert.equal(rt.getBlock('use').calculation.result,null);
});

test('F1a ordinary definition, lexical parameter and function application remain active',async()=>{
  const rt = DocumentRuntime.createSemantic('ordinary');
  add(rt,'outside','x:=99'); add(rt,'f','f(x):=x+1'); add(rt,'call','f(2)');
  assert.deepEqual(rt.deriveSemanticTask('A').analysis.graph.getUpstream('f'),[]);
  assert.equal((await run(rt)).kind,'complete');
  assert.equal(value(rt,'call'),'3');
});

for (const [source] of broken.slice(0,2)) {
  test(`F1a capability failure cannot invoke a backend or fabricate success: ${source}`,async()=>{
    const snapshot = deriveSourceSemanticSnapshot([{id:'bad',source}],parse,'A');
    let backendCalls = 0;
    const evaluate = createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision:'r1',
      evaluate:async()=>{backendCalls++;return {blockId:'bad',status:'success',value:integer(99)};}});
    const result = await evaluate({blockId:'bad',taskScopeId:'A',source,providers:[],upstream:[]});
    assert.equal(result.status,'failure');
    assert.equal(result.code,'unsupported-operation');
    assert.ok(isDiagnostic(result.diagnostic));
    assert.equal(Object.hasOwn(result,'value'),false);
    assert.equal(backendCalls,0);
  });
}

test('F1a statement conversion does not shadow a real callable writer',async()=>{
  const rt = DocumentRuntime.createSemantic('callable');
  add(rt,'first','f(x):=x+1');
  add(rt,'bad','f(x):=missing(x) -> [m]');
  add(rt,'use','f(2)');
  const {snapshot,analysis} = rt.deriveSemanticTask('A');
  assert.deepEqual(snapshot.writers.map(w=>w.writerId),['first']);
  assert.deepEqual(snapshot.blocks[1].calls,[]);
  assert.deepEqual(analysis.graph.getUpstream('bad'),[]);
  assert.equal(analysis.bindings.get('use').get('f'),'first');
  assert.equal((await run(rt)).kind,'complete');
  assert.equal(rt.getBlock('bad').calculation.error.code,'unsupported-operation');
  assert.equal(value(rt,'use'),'3');
});
