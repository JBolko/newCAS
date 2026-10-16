/** P0021 Slice 80 — require real retirement, not just a no-import declaration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const src='src/js/semantics/';
const get=p=>readFileSync(resolve(root,p),'utf8');
const retired=[
 'create-source-integer-assignment-task-evaluator.js',
 'create-source-expression-task-evaluator.js',
 'create-source-composed-expression-task-evaluator.js',
];
test('S80: three historically redundant source evaluators are removed',()=>{
 for(const file of retired) assert.equal(existsSync(resolve(root,src,file)),false,`still exists: ${file}`);
});
test('S80: active batch remains attested-IR based with separate definition compilation',()=>{
 const batch=get(src+'create-runtime-function-batch-evaluator.js');
 assert.match(batch,/createAttestedIRTaskEvaluator/);
 assert.match(batch,/createSourceFunctionDefinitionTaskEvaluator/);
 for(const identifier of ['createSourceIntegerAssignmentTaskEvaluator','createSourceExpressionTaskEvaluator','createSourceComposedExpressionTaskEvaluator'])
  assert.doesNotMatch(batch,new RegExp(identifier));
});
