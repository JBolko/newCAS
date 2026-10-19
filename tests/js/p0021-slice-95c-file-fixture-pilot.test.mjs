/** P0021 S95c: bounded test-only file-fixture ingestion. No production editor/persistence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseS95cTestFixture,S95C_FIXTURE_VERSION,S95C_MAX_FIXTURE_BYTES} from
  '../browser/p0021-slice-95c-test-fixture.mjs';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fixturePath='tests/browser/fixtures/p0021-slice-95c-three-formulas.json';
const pilotPath='tests/browser/p0021-slice-95b-selected-ui-pilot.mjs';
const pagePath='tests/browser/p0021-slice-95b-selected-ui-pilot.html';
const fixture=(blocks,more={})=>JSON.stringify({fixtureVersion:S95C_FIXTURE_VERSION,blocks,...more});
const blocks=[{id:'pilot-a',source:'a:=2'},{id:'pilot-f',source:'f(t):=t^2+a'},
  {id:'pilot-result',source:'f(3)'}];
const bad=(raw,pattern)=>assert.throws(()=>parseS95cTestFixture(raw),pattern);

test('S95c fixed test fixture imports the three documented source strings and freezes them',()=>{
  const decoded=parseS95cTestFixture(read(fixturePath));
  assert.deepEqual(decoded,blocks);
  assert.ok(Object.isFrozen(decoded));
  assert.ok(decoded.every(Object.isFrozen));
});
test('S95c reorders valid source rows by existing pilot block ID, never by input position',()=>{
  assert.deepEqual(parseS95cTestFixture(fixture([...blocks].reverse())),blocks);
});
test('S95c malformed JSON is a structured fixture parse failure',()=>{
  bad('{','/S95C_FIXTURE_JSON/');
});
test('S95c denies non-object roots and version mismatch',()=>{
  bad('null',/S95C_FIXTURE_SHAPE/);
  bad(JSON.stringify({fixtureVersion:'ncas-v1',blocks}),/S95C_FIXTURE_SHAPE/);
});
test('S95c unknown root fields are rejected rather than becoming metadata',()=>{
  bad(fixture(blocks,{unsafe:true}),/S95C_FIXTURE_SHAPE/);
});
test('S95c exact block set is mandatory and duplicate IDs fail closed',()=>{
  bad(fixture(blocks.slice(0,2)),/S95C_FIXTURE_SHAPE/);
  bad(fixture([blocks[0],blocks[1],blocks[1]]),/S95C_FIXTURE_BLOCK/);
});
test('S95c foreign block IDs and foreign block keys cannot reach document inputs',()=>{
  bad(fixture([blocks[0],blocks[1],{id:'__proto__',source:'x:=3'}]),/S95C_FIXTURE_BLOCK/);
  bad(fixture([blocks[0],blocks[1],{...blocks[2],status:'success'}]),/S95C_FIXTURE_BLOCK/);
});
test('S95c source is data, not parsed, evaluated, or sanitized into different mathematics',()=>{
  const arbitrary='not-yet-a-valid-formula(';
  const decoded=parseS95cTestFixture(fixture([{...blocks[0],source:arbitrary},...blocks.slice(1)]));
  assert.equal(decoded[0].source,arbitrary);
});
test('S95c source type, null bytes, and per-block length are bounded',()=>{
  bad(fixture([{...blocks[0],source:3},...blocks.slice(1)]),/S95C_FIXTURE_BLOCK/);
  bad(fixture([{...blocks[0],source:'x\0y'},...blocks.slice(1)]),/S95C_FIXTURE_BLOCK/);
  bad(fixture([{...blocks[0],source:'x'.repeat(1025)},...blocks.slice(1)]),/S95C_FIXTURE_BLOCK/);
});
test('S95c entire decoded fixture is byte-size bounded and rejects non-string input',()=>{
  bad(' '.repeat(S95C_MAX_FIXTURE_BYTES+1),/S95C_FIXTURE_SIZE/);
  bad(null,/S95C_FIXTURE_SIZE/);
});
test('S95c page exposes local file picker, explicit import and explicit calculation',()=>{
  const html=read(pagePath);
  assert.match(html,/id="fixture-file"/);
  assert.match(html,/id="load-fixture"/);
  assert.match(html,/id="accept-95c"/);
  assert.match(html,/id="evaluate"/);
  assert.match(html,/ikke \.ncas-dokumenter/);
});
test('S95c file ingestion only updates draft input values, never writes document source',()=>{
  const js=read(pilotPath);
  const apply=js.slice(js.indexOf('function applyFixtureToDrafts('),js.indexOf('// Host still owns revision;'));
  assert.match(apply,/parseS95cTestFixture\(fixture\)/);
  assert.match(apply,/entry\[1\]\.value = source/);
  assert.doesNotMatch(apply,/setBlockSource|session\.run|\.calculate\(/);
  assert.match(js,/if \(file\.size > S95C_MAX_FIXTURE_BYTES\)/);
  assert.match(js,/applyFixtureToDrafts\(await file\.text\(\)\)/);
});
test('S95c browser acceptance runs real Pyodide only after draft import and explicit run',()=>{
  const js=read(pilotPath);
  assert.match(js,/fetch\('\.\/fixtures\/p0021-slice-95c-three-formulas\.json',\{cache:'no-store'\}\)/);
  assert.match(js,/applyFixtureToDrafts\(fixture\);/);
  assert.match(js,/Filimport ændrer kladden, men ikke DocumentRuntimes kilde/);
  assert.match(js,/Efter eksplicit beregning: indlæst testfil giver 11 via Pyodide/);
  assert.match(js,/selected-pyodide-worker\.js/);
  assert.doesNotMatch(js,/\.innerHTML\s*=|\.outerHTML\s*=|\beval\s*\(/);
});
test('S95c browser module graph contains no legacy engine, transformer, or alternate evaluator',()=>{
  const graph=traceStaticGraph(ROOT,pilotPath);
  assert.deepEqual(graph.unresolved,[]);
  for(const suffix of ['cas-engine.js','transformer.js','python-files.js','legacy/compile-legacy-unit.js'])
    assert.equal(graph.modules.some(m=>m.endsWith(suffix)),false,suffix);
});
