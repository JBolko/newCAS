import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {compileAttestedDocumentExpressionIR} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';
import {runSourceListCases,sourceListSpecs} from '../helpers/s100c-source-list-cases.mjs';

test('S100c both compilers lower lists to ordinary calls with ordered provider references',()=>{
  const specs=sourceListSpecs(),ast=parse('{n,4,n}')[0];
  const ir=compileSelectedSourceAst(ast,{specs,resolveVariable:()=>providerReference('writer-n')});
  const attested=compileAttestedDocumentExpressionIR(ast,{blockId:'A',specs,
    entry:{parseError:null,calls:[],references:[{name:'n',binding:providerReference('writer-n')}]}});
  assert.deepEqual(ir,attested);
  assert.equal(ir.kind,'call');assert.equal(ir.callee.operationId,'list');
  assert.deepEqual(ir.args.map(a=>a.providerId??a.value.data.expr.value),['writer-n','4','writer-n']);
  assert.ok(Object.isFrozen(ir.args));
  assert.throws(()=>compileSelectedSourceAst(parse('[2,4]'),{specs}),/unsupported node type Vector/);
  assert.throws(()=>compileSelectedSourceAst(ast,{specs:new Map(),resolveVariable:()=>providerReference('n')}),/unselected operation list/);
});

test('S100c real desktop handlers through selected bootstrap: document lists, isolation and recomputation',async()=>{
  let payload;
  const py={loadPackage:async()=>{},FS:{mkdirTree(){},writeFile(){}},globals:{set:(_k,v)=>payload=v,delete(){}},
    runPythonAsync:async source=>{
      if(source.startsWith('import sys'))return;
      const out=spawnSync('python',['-c','import sys\n_newcas_request_json=sys.stdin.read()\n'+source+'\nprint(json.dumps(_result,allow_nan=False))'],{input:payload,encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);return out.stdout.trim();
    }};
  const runtime=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'desktop://test/'});
  const result=await runSourceListCases(runtime.evaluateSelected);
  assert.equal(result.pass,5);assert.ok(result.requests>0);
});
