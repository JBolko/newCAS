/** S95g — EXISTING renderer consumes public Value / P0009 projection safely. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderSemanticCalculation} from '../../src/js/renderer.js';
import {expression,functionValue,finiteSet} from '../../src/js/values/value.js';
import {diagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
// No browser needed for pure render-to-text projection tests. Access to
// innerHTML is deliberately forbidden to rule out accidental HTML injection.
function target() {
  let content='unrendered';
  return {
    get textContent(){return content;},set textContent(v){content=v;},
    get innerHTML(){throw new Error('HTML_ACCESS_FORBIDDEN');},
    set innerHTML(_){throw new Error('HTML_ACCESS_FORBIDDEN');},
  };
}
function success(result){return {status:'success',result,error:null};}
function failure(code,diagnosticValue){return {status:'error',result:null,
  error:{code,message:'untrusted <img src=x onerror=alert(1)>',
    ...(diagnosticValue!==undefined?{diagnostic:diagnosticValue}:{})}};}
function render(calc){const output=target(),decimal=target();renderSemanticCalculation(calc,output,decimal);
  return [output.textContent,decimal.textContent];}

test('S95g renders selected exact integer without locale conversion or HTML',()=>{
  assert.deepEqual(render(success(expression({op:'integer',value:'1234567890123456789012345'}))),
    ['= 1234567890123456789012345','']);
});
test('S95g renders selected rational exactly, not as a rounded JavaScript number',()=>{
  assert.equal(render(success(expression({op:'rational',numerator:'1',denominator:'3'})))[0],'= 1/3');
});
test('S95g marks approximate Value as approximate, preserves precision source string',()=>{
  assert.equal(render(success(expression({op:'approx',value:'1.23456789',precisionBits:80})))[0],'≈ 1.23456789');
});
test('S95g renders FunctionValue by kind, does not compute or inspect its body',()=>{
  assert.equal(render(success(functionValue([],expression({op:'integer',value:'7'}))))[0],'OK (function)');
});
test('S95g unsupported but valid symbolic expression is not silently rendered as a number',()=>{
  const value=expression({op:'add',args:[{op:'integer',value:'1'},{op:'integer',value:'2'}]});
  assert.equal(render(success(value))[0],'PRESENTATION_UNSUPPORTED_VALUE');
});
test('S95g unsupported SetValue is displayed fail-closed, not coerced into a legacy envelope',()=>{
  assert.equal(render(success(finiteSet([expression({op:'integer',value:'2'})])))[0],
    'PRESENTATION_UNSUPPORTED_VALUE');
});
test('S95g invalid Value is detected and not interpolated into markup',()=>{
  assert.equal(render(success({kind:'expression',data:{expr:{op:'integer',value:'<script>'}}}))[0],
    'PRESENTATION_INVALID_VALUE');
});
test('S95g P0009 diagnostic uses its code, never the backend/legacy error message',()=>{
  assert.deepEqual(render(failure('WORKER_TIMEOUT',diagnostic('WORKER_TIMEOUT',{timeoutMs:10000}))),
    ['error: WORKER_TIMEOUT','']);
});
test('S95g legacy compatibility code-only errors remain visible as codes',()=>{
  assert.equal(render(failure('UPSTREAM_FAILED'))[0],'error: UPSTREAM_FAILED');
});
test('S95g malformed/mismatched P0009 diagnostic fails closed',()=>{
  assert.equal(render(failure('WORKER_TIMEOUT',diagnostic('WORKER_CRASH',{})))[0],
    'error: DIAGNOSTIC_UNAVAILABLE');
  assert.equal(render(failure('WORKER_TIMEOUT',{diagnosticVersion:1,code:'WORKER_TIMEOUT',parameters:{}}))[0],
    'error: DIAGNOSTIC_UNAVAILABLE');
});
test('S95g untrusted error codes with markup characters are not presented verbatim',()=>{
  assert.equal(render(failure('X<img src=x>'))[0],'error: DIAGNOSTIC_UNAVAILABLE');
});
test('S95g idle/dirty/running/blocked and missing projection use only status text',()=>{
  assert.equal(render(null)[0],'kladde');
  for (const status of ['idle','dirty','running','blocked'])
    assert.equal(render({status})[0],status);
  assert.equal(render({status:'spontaneous-success'})[0],'PRESENTATION_INVALID_STATUS');
});
test('S95g missing targets fail before touching presentation state',()=>{
  assert.throws(()=>renderSemanticCalculation(success(expression({op:'integer',value:'1'})),{}),
    /S95G_PRESENTATION_TARGET/);
});
test('S95g semantic renderer stays in existing renderer.js, not a second renderer or backend',()=>{
  const renderer=fs.readFileSync(path.join(ROOT,'src/js/renderer.js'),'utf8');
  const pilot=fs.readFileSync(path.join(ROOT,'tests/browser/p0021-slice-95f-dynamic-document.mjs'),'utf8');
  const main=fs.readFileSync(path.join(ROOT,'src/js/main.js'),'utf8');
  assert.match(renderer,/export function renderSemanticCalculation/);
  assert.match(pilot,/import \{renderSemanticCalculation\} from '\.\.\/\.\.\/src\/js\/renderer\.js'/);
  assert.match(pilot,/renderSemanticCalculation\(calc,line\.querySelector\('output'\)\)/);
  assert.match(main,/import \{ CASEngine \}/); // No production route switch yet
  const graph=traceStaticGraph(ROOT,'tests/browser/p0021-slice-95f-dynamic-document.mjs');
  assert.deepEqual(graph.unresolved,[]);
  assert.ok(graph.modules.includes('src/js/renderer.js'));
  assert.ok(!graph.modules.includes('src/js/main.js'));
  assert.ok(!graph.modules.includes('src/js/cas-engine.js'));
  assert.ok(!graph.modules.includes('src/js/transformer.js'));
});
