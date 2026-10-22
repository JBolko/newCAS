import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parse} from '../../src/js/parser.mjs';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {sourceListSpecs} from '../helpers/s100c-source-list-cases.mjs';
import {runNumericSourceCases} from '../helpers/s100d-numeric-source-cases.mjs';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';

test('S100d generated parser retains raw literal text and existing separator semantics',()=>{
  for(const source of ['9007199254740993','0.1','0.2','0.12345678901234567890123456789','0002.500']){
    const ast=parse(source)[0];assert.equal(ast.raw,source);
    assert.equal(JSON.parse(JSON.stringify(ast)).raw,source);
  }
  assert.equal(parse('-9007199254740993')[0].argument.raw,'9007199254740993');
  assert.equal(parse('f(0.1,0.2)')[0].args.length,2);
  assert.equal(parse('f(0.1;0.2)')[0].args.length,2);
  assert.throws(()=>parse('0,1'));
  assert.equal(parse('1e3')[0].right.name,'e3'); // existing scientific-notation gate remains.
});

test('S100d lowering uses raw digits and refuses lossy ASTs without source information',()=>{
  const specs=sourceListSpecs();
  const ast=parse('9007199254740993')[0];
  assert.equal(compileSelectedSourceAst(ast,{specs}).value.data.expr.value,'9007199254740993');
  ast.value=0; // compatibility projection is never authoritative.
  assert.equal(compileSelectedSourceAst(ast,{specs}).value.data.expr.value,'9007199254740993');
  assert.throws(()=>compileSelectedSourceAst({type:'Literal',value:9007199254740992},{specs}));
  assert.throws(()=>compileSelectedSourceAst({type:'Literal',value:1,raw:'1e3'},{specs}));
});

test('S100d source/IR/Value/gateway path retains exact numeric values on desktop Python',async()=>{
  let payload;
  const py={loadPackage:async()=>{},FS:{mkdirTree(){},writeFile(){}},globals:{set:(_k,v)=>payload=v,delete(){}},
    runPythonAsync:async source=>{
      if(source.startsWith('import sys'))return;
      const out=spawnSync('python',['-c','import sys\n_newcas_request_json=sys.stdin.read()\n'+source+'\nprint(json.dumps(_result,allow_nan=False))'],{input:payload,encoding:'utf8'});
      assert.equal(out.status,0,out.stderr);return out.stdout.trim();
    }};
  const runtime=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'desktop://test/'});
  assert.equal((await runNumericSourceCases(runtime.evaluateSelected)).pass,4);
});
