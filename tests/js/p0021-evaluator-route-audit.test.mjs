/** P0021 Slice 69 — auditable production evaluation routes, not a deletion exercise. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=relative=>readFileSync(resolve(root,relative),'utf8');
const batch='src/js/semantics/create-runtime-function-batch-evaluator.js';
const definition='src/js/semantics/create-source-function-definition-task-evaluator.js';
const recursive='src/js/semantics/create-attested-ir-task-evaluator.js';
const legacy=[
 'create-source-integer-assignment-task-evaluator.js',
 'create-source-literal-function-task-evaluator.js',
 'create-source-variable-function-task-evaluator.js',
 'create-source-expression-task-evaluator.js',
 'create-bound-function-task-evaluator.js',
 'create-source-composed-expression-task-evaluator.js',
];
// Only static relative imports: this is an *explicitly bounded* graph audit,
// not a claim to cover runtime dynamic imports or external consumers.
function localReachable(entry){
 const visited=new Set();
 function visit(path){
  path=resolve(path);
  if(visited.has(path))return;
  assert.ok(existsSync(path),`missing module ${path}`);
  visited.add(path);
  const content=readFileSync(path,'utf8');
  for(const m of content.matchAll(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"](\.[^'"]+)['"]/g)){
   const child=resolve(dirname(path),m[1]);
   visit(extname(child)?child:child+'.js');
  }
 }
 visit(resolve(root,entry));
 return visited;
}

test('production batch selects definition and attested IR expression evaluators',()=>{
 const src=source(batch);
 assert.match(src,/createSourceFunctionDefinitionTaskEvaluator\(/);
 assert.match(src,/createAttestedIRTaskEvaluator\(/);
 assert.doesNotMatch(src,/createSourceComposedExpressionTaskEvaluator\(/);
 assert.match(src,/\['Assignment','FunctionCall','Variable'\]/);
 assert.doesNotMatch(src,/createSource(?:IntegerAssignment|LiteralFunction|VariableFunction|Expression)TaskEvaluator\(/);
});
test('static production evaluation graph reaches both active evaluator routes',()=>{
 const graph=localReachable(batch);
 for(const route of [definition,recursive]) assert.ok(graph.has(resolve(root,route)),`missing active route ${route}`);
});
test('historical evaluator adapters are not statically reachable from active batch',()=>{
 const graph=localReachable(batch);
 for(const file of legacy) assert.ok(!graph.has(resolve(root,'src/js/semantics',file)),`legacy route reintroduced: ${file}`);
});
test('S81: retired source adapters are absent after migration',()=>{
 for(const file of [
  'create-source-integer-assignment-task-evaluator.js',
  'create-source-expression-task-evaluator.js',
  'create-source-composed-expression-task-evaluator.js',
  'create-source-literal-function-task-evaluator.js',
  'create-source-variable-function-task-evaluator.js',
 ]) assert.ok(!existsSync(resolve(root,'src/js/semantics',file)),`retired adapter still present: ${file}`);
 for(const file of [
  'create-bound-function-task-evaluator.js',
 ]) assert.ok(existsSync(resolve(root,'src/js/semantics',file)),`still-required contract consumer missing: ${file}`);
});
