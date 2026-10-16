/** Slice 79 — active invariants, not historical implementation preservation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const batch=read('src/js/semantics/create-runtime-function-batch-evaluator.js');
const audit=read('tests/js/p0021-ir-legacy-retirement-readiness.test.mjs');

test('S79: active expression execution continues to use attested IR',()=>{
 assert.match(batch,/createAttestedIRTaskEvaluator/);
 assert.match(batch,/createSourceFunctionDefinitionTaskEvaluator/);
 assert.doesNotMatch(batch,/createSource(?:IntegerAssignment|VariableFunction|LiteralFunction|ComposedExpression|Expression)TaskEvaluator/);
});
test('S79: retirement audit guards reachability without insisting on file preservation',()=>{
 assert.match(audit,/none of six historical evaluator modules is reachable/);
 assert.doesNotMatch(audit,/assert\.ok\(existsSync\(resolve\(root,src\+file\)\)/);
});
test('S79: IR bridge retains explicit provider and revision boundaries',()=>{
 const bridge=read('src/js/semantics/create-attested-ir-task-evaluator.js');
 assert.match(bridge,/getProviderOutcome/);
 assert.match(bridge,/revision/);
 assert.match(bridge,/compileAttestedDocumentExpressionIR/);
 assert.match(bridge,/evaluateAttestedDocumentIR/);
});
