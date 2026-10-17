/** P0021 Slice 70 — bounded repository consumer inventory and P0004 drift evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const legacy=[
 'create-source-integer-assignment-task-evaluator.js',
 'create-source-literal-function-task-evaluator.js',
 'create-source-variable-function-task-evaluator.js',
 'create-source-expression-task-evaluator.js',
 'create-bound-function-task-evaluator.js',
];
const read=path=>readFileSync(resolve(root,path),'utf8');
function sources(dir){
 const out=[];
 function visit(d){
  for(const e of readdirSync(resolve(root,d),{withFileTypes:true})){
   const path=`${d}/${e.name}`;
   if(e.isDirectory())visit(path);
   else if(['.js','.mjs','.cjs'].includes(extname(path)))out.push(path);
  }
 }
 visit(dir); return out;
}
const importsOf=(code)=>[...code.matchAll(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s*)?['"](\.[^'"]+)['"]/g)].map(m=>m[1].split('?')[0]);
function directConsumers(){
 const results=[];
 for(const path of [...sources('src/js'),...sources('tests/js'),...sources('tests/browser')]){
  const code=read(path);
  for(const imp of importsOf(code)){
   const target=resolve(root,path,'..',imp);
   const repoTarget=relative(root,target).replaceAll('\\','/');
   if(legacy.some(file=>repoTarget===`src/js/semantics/${file}`))results.push({path,target:repoTarget});
  }
 }
 return results;
}

test('production imports none of the five historical evaluator adapters',()=>{
 const production=directConsumers().filter(x=>x.path.startsWith('src/js/'));
 assert.deepEqual(production,[],`unexpected production consumers: ${JSON.stringify(production)}`);
});
test('legacy path matching is platform-independent',()=>{
 const expected='src/js/semantics/create-bound-function-task-evaluator.js';
 const win='src\\js\\semantics\\create-bound-function-task-evaluator.js';
 assert.equal(win.replaceAll('\\','/'),expected);
 assert.ok(legacy.some(file=>expected===`src/js/semantics/${file}`));
});
test('S84: retired adapter modules have no remaining direct consumers',()=>{
 assert.deepEqual(directConsumers(),[], 'retired adapter imported after active-IR migration');
});
test('active production batch is outside the direct legacy import set',()=>{
 assert.ok(!directConsumers().some(x=>x.path.endsWith('create-runtime-function-batch-evaluator.js')));
 const batch=read('src/js/semantics/create-runtime-function-batch-evaluator.js');
 assert.match(batch,/createAttestedIRTaskEvaluator/);
 assert.doesNotMatch(batch,/createSourceComposedExpressionTaskEvaluator/);
 assert.match(batch,/createSourceFunctionDefinitionTaskEvaluator/);
});
test('P0004 new Worker pin agrees with the selected baseline; legacy engine remains pinned separately',()=>{
 const policy=read('docs/architecture/P0004-version-lock-and-developer-baseline.md');
 const worker=read('src/js/evaluation/selected-pyodide-worker.js');
 const oldApp=read('src/js/cas-engine.js');
 assert.match(policy,/Pyodide\s+314\.0\.7/);
 assert.match(policy,/SymPy\s+1\.14\.0/);
 assert.match(worker,/pyodide\/v314\.0\.7\/full/);
 assert.doesNotMatch(worker,/pyodide\/v0\.26\.1\/full/);
 assert.match(oldApp,/pyodide\/v0\.26\.1\/full/);
 // Static agreement is not evidence that the selected runtime loads SymPy.
 // Real-browser version and execution probes remain required for Slice 71.
});
