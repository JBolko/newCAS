import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {list, vector, expression, isValue} from '../../src/js/values/value.js';
import {call, operationReference, valueLiteral} from '../../src/js/semantics/semantic-ir.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';

const integer = value => expression({op:'integer',value:String(value)});
const envelope = {protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b',
  taskScopeId:'internal',source:'internal Value fixture',providers:[]};
const select = value => compileSelectedValueCall(envelope,
  call(operationReference('mean'),[valueLiteral(value)]),findSelectedOperationSpec('mean'));

test('S100b mean retains its pure unary value signature in the existing catalog',()=>{
  const spec=findSelectedOperationSpec('mean');
  assert.ok(spec);
  assert.equal(spec.evaluatorId,'probe.statistics.mean');
  assert.equal(spec.purity,'pure');
  assert.deepEqual(spec.signatures[0],{arguments:[{name:'data',role:'value'}]});
});

// Execute the production Pyodide bootstrap's static Python entry on desktop
// Python. This checks real selection/handler plumbing, not a fake math result.
// The separate browser fixture supplies actual Worker/Pyodide evidence.
test('S100b selected runtime dispatches integer list without JS Number coercion',async()=>{
  let payload;
  const loaded=[];
  const py={loadPackage:async()=>{}, FS:{mkdirTree(){},writeFile:p=>loaded.push(p)},
    globals:{set:(_key,v)=>payload=v,delete(){}},
    runPythonAsync:async source=>{
      if(source.startsWith('import sys'))return;
      const code='import sys\n_newcas_request_json=sys.stdin.read()\n'+source+'\nprint(json.dumps(_result,allow_nan=False))';
      const result=spawnSync('python',['-c',code],{input:payload,encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      return result.stdout.trim();
    }};
  const runtime=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'fixture://desktop/'});
  for(const [numbers,expected] of [
    [['2','4','6','8'],{op:'integer',value:'5'}],
    [['1','2','4'],{op:'rational',numerator:'7',denominator:'3'}],
    [['-2','4','4'],{op:'integer',value:'2'}],
    [['9007199254740993'],{op:'integer',value:'9007199254740993'}],
  ]){
    const input=list(numbers.map(integer)), before=JSON.stringify(input);
    const out=await runtime.evaluateSelected(envelope,select(input));
    assert.deepEqual(out.value,expression(expected));
    assert.equal(JSON.stringify(input),before);
    assert.ok(isValue(input));
  }
  assert.ok(loaded.some(p=>p.endsWith('/list_mean.py')));
  for(const input of [vector([integer(2)]),list([]),list([expression({op:'approx',value:'2.0'})])]){
    const out=await runtime.evaluateSelected(envelope,select(input));
    assert.equal(out.status,'failure');
    assert.equal(out.diagnostic.code,'type-mismatch');
    assert.equal(out.diagnostic.parameters.argument,'data');
  }
});
