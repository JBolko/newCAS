import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {decodeValue,expression} from '../../src/js/values/value.js';
import {evaluationSuccess,isEvaluationOutcome} from '../../src/js/evaluator/evaluation-contract.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {populationRoot} from '../helpers/s100e-statistics-cases.mjs';
import {evaluateNestedSelectedCalls} from '../../src/js/semantics/evaluate-nested-selected-calls.js';
import {call,operationReference,valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {list} from '../../src/js/values/value.js';
import {isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';

test('S100e gate: existing SymPy adapter and P0005/P0010 carry an exact irrational square root',()=>{
  const code='import json,sympy as sp\nfrom src.python.adapters.sympy_value_adapter import SympyValueAdapter\na=SympyValueAdapter()\nv=a.from_backend(sp.sqrt(sp.Rational(2,3)))\nassert sp.simplify(a.to_backend(v)**2-sp.Rational(2,3))==0\nassert not a.to_backend(v).has(sp.Float)\nprint(json.dumps(v))';
  const out=spawnSync('python',['-c',code],{encoding:'utf8'});
  assert.equal(out.status,0,out.stderr);
  const value=decodeValue(out.stdout.trim());
  assert.deepEqual(value,expression(populationRoot));
  assert.ok(isEvaluationOutcome(evaluationSuccess(value)));
});

test('S100e selected population operations retain their pure unary value signature',()=>{
  for(const op of ['mean','variance','standard_deviation']){
    const spec=findSelectedOperationSpec(op);assert.ok(spec,op);
    assert.equal(spec.evaluatorId,`probe.statistics.${op}`);
    assert.equal(spec.purity,'pure');
    assert.deepEqual(spec.signatures[0],{arguments:[{name:'data',role:'value'}]});
  }
});

test('S100e selected failure retains P0009 facts for the existing document dispatch bridge',async()=>{
  const env={protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'bad',taskScopeId:'T',source:'variance({})',providers:[]};
  const facts={operationId:'variance',argument:'data',expectedKinds:['nonempty-list-of-exact-rational-expressions'],actualKind:'list'};
  const wire={diagnosticVersion:1,code:'type-mismatch',parameters:facts};
  await assert.rejects(evaluateNestedSelectedCalls({envelope:env,ir:call(operationReference('variance'),[valueLiteral(list([]))]),
    specs:new Map([['variance',findSelectedOperationSpec('variance')]]),
    evaluate:async()=>({blockId:'bad',status:'failure',code:'type-mismatch',diagnostic:wire})}),error=>{
      assert.ok(isDiagnostic(error.diagnostic));
      assert.deepEqual(error.diagnostic.parameters,facts);
      return true;
    });
  for(const invalid of [{...wire,code:'other-code'},{...wire,diagnosticVersion:2},{code:'type-mismatch',diagnosticVersion:1}])
    await assert.rejects(evaluateNestedSelectedCalls({envelope:env,ir:call(operationReference('variance'),[valueLiteral(list([]))]),
      specs:new Map([['variance',findSelectedOperationSpec('variance')]]),
      evaluate:async()=>({blockId:'bad',status:'failure',code:'type-mismatch',diagnostic:invalid})}),error=>!isDiagnostic(error.diagnostic));
});
