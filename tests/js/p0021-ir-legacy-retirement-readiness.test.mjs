/** P0021 Slice 78: historical evaluator retirement evidence, NOT deletion approval.
 * A bounded static-import audit plus explicit migration witness map.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const src='src/js/semantics/';
const batch=src+'create-runtime-function-batch-evaluator.js';
const content=p=>readFileSync(resolve(root,p),'utf8');
const legacy=Object.freeze([
 'create-source-integer-assignment-task-evaluator.js',
 'create-source-literal-function-task-evaluator.js',
 'create-source-variable-function-task-evaluator.js',
 'create-source-expression-task-evaluator.js',
 'create-bound-function-task-evaluator.js',
 'create-source-composed-expression-task-evaluator.js',
]);
// Migration witnesses prove supported active behaviors, not every historical API contract.
const witnesses=Object.freeze([
 ['assignment and long identifier','p0021-runtime-ir-batch-migration.test.mjs',/long identifier/],
 ['nested calls and repeated callable','p0021-runtime-ir-batch-migration.test.mjs',/repeated nested invocation/],
 ['lexical capture recomputation','p0021-runtime-ir-batch-migration.test.mjs',/revised capture/],
 ['no later-provider fallback','p0021-runtime-ir-batch-migration.test.mjs',/no fallback/],
 ['concurrent tasks and generations','p0021-ir-task-generation-stress.test.mjs',/stale|generation/i],
]);
function reachable(entry){
 const seen=new Set();
 function visit(file){
  const path=resolve(root,file);
  if(seen.has(path))return;
  assert.ok(existsSync(path),`missing dependency: ${file}`);
  seen.add(path);
  for(const match of content(file).matchAll(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"](\.[^'"]+)['"]/g)){
   const base=resolve(dirname(path),match[1].split('?')[0]);
   const child=extname(base)?base:base+'.js';
   visit(child);
  }
 }
 visit(entry);
 return seen;
}
test('S78: production entry uses resolved IR, not legacy expression dispatch',()=>{
 const text=content(batch);
 assert.match(text,/createAttestedIRTaskEvaluator/);
 assert.match(text,/createSourceFunctionDefinitionTaskEvaluator/);
 assert.doesNotMatch(text,/createSource(?:IntegerAssignment|VariableFunction|LiteralFunction|ComposedExpression|Expression)TaskEvaluator/);
});
test('S78: none of six historical evaluator modules is reachable by static relative imports',()=>{
 const seen=reachable(batch);
 for(const file of legacy) assert.ok(!seen.has(resolve(root,src+file)),`unexpected production reachability: ${file}`);
});
test('S78: explicit active-IR migration witnesses remain present',()=>{
 for(const [scenario,file,pattern] of witnesses){
  const path='tests/js/'+file;
  assert.ok(existsSync(resolve(root,path)),`missing witness for ${scenario}: ${path}`);
  assert.match(content(path),pattern,`missing scenario: ${scenario}`);
 }
});
test('S78 revised by S79: retirement gate protects the active implementation',()=>{
 const bridge=content('src/js/semantics/create-attested-ir-task-evaluator.js');
 assert.match(bridge,/compileAttestedDocumentExpressionIR/);
 assert.match(bridge,/evaluateAttestedDocumentIR/);
});
