/** S100m1: accepted representation only; no Worker or statistical calculation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as values from '../../src/js/values/value.js';
import {isDiagnostic, valueCodecDiagnostic, VALUE_CODEC_DIAGNOSTIC_SPECS} from '../../src/js/diagnostics/diagnostic.js';

const fixtures = JSON.parse(readFileSync(new URL('../fixtures/statistics-value-v2.json', import.meta.url), 'utf8'));
const fixture = name => structuredClone(fixtures.find(f => f.name === name).value);
const group = () => fixture('grouped');
const result = () => fixture('symbolic-result');
const make = value => value.kind === 'list' ? values.listV2(value.data.items) : values.statisticsValue(value.data);
const limits = {depth:128,nodes:100000,'encoded-bytes':8*1024*1024};
function resourceFailure(action, resource) {
  assert.throws(action, error => {
    assert.equal(error.diagnostic?.code,'value-codec-resource-limit');
    assert(isDiagnostic(error.diagnostic));
    assert.equal(error.diagnostic.parameters.resource,resource);
    assert.equal(error.diagnostic.parameters.limit,limits[resource]);
    return true;
  });
}
function rejected(value, code = 'invalid-value-encoding') {
  assert.throws(() => make(value), error => {
    assert.equal(error.diagnostic?.code, code);
    assert(isDiagnostic(error.diagnostic));
    assert.equal(typeof error.diagnostic.parameters.path, 'string');
    return true;
  });
}

for (const f of fixtures) test(`S100m1 canonical JS/Python fixture: ${f.name}`, () => {
  const value = values.decodeValue(JSON.stringify(f.value));
  assert(values.isValue(value));
  assert.equal(values.encodeValue(value), f.canonical);
  assert.equal(values.encodeValue(make(f.value)), f.canonical);
  assert(Object.isFrozen(value.data));
});

test('S100m1 old v1 factories, bytes and recursive meaning remain unchanged', () => {
  assert.equal(values.VALUE_VERSION, 1);
  const n = values.expression({op:'integer', value:'9007199254740993'});
  const list = values.list([n]);
  const expected = '{"valueVersion":1,"kind":"list","data":{"items":[{"valueVersion":1,"kind":"expression","data":{"expr":{"op":"integer","value":"9007199254740993"}}}]}}';
  assert.equal(values.encodeValue(list), expected);
  assert.equal(values.encodeValue(values.decodeValue(expected)), expected);
  for (const wrap of [x=>values.list([x]),x=>values.vector([x]),x=>values.matrix([[x]]),x=>values.quantity(x,'m'),x=>values.relation('eq',n,x)]) {
    assert.throws(() => wrap(group()));
  }
});

test('S100m1 canonical record order and assumptions order, not numeric class sorting', () => {
  const raw = result();
  raw.data.assumptions = ['z-model/v2','a-model/v1'];
  raw.data = Object.fromEntries(Object.entries(raw.data).reverse());
  const value = make(raw);
  assert.deepEqual(value.data.assumptions, ['a-model/v1','z-model/v2']);
  assert.deepEqual(Object.keys(value.data), ['variant','statisticId','methodId','estimand','arithmetic','estimateStatus','assumptions','provenance','value']);
  assert.equal(value.data.provenance.inputs[0].value.data.classes[0].count.data.expr.value, '9007199254740993');
});

test('S100m1 detached immutable results retain complete provenance', () => {
  const raw = fixture('derived-result');
  const value = make(raw);
  const before = values.encodeValue(value);
  raw.data.provenance.inputs[0].value.data.provenance.inputs[0].value.data.classes[0].count.data.expr.value = '7';
  raw.data.value.data.expr = {op:'integer',value:'0'};
  assert.equal(values.encodeValue(value), before);
  assert.throws(() => { value.data.provenance.inputs[0].value.data.methodId = 'changed/v1'; }, TypeError);
  assert(Object.isFrozen(value.data.provenance.inputs[0].value.data.provenance.inputs[0].value.data.classes[0]));
  assert.equal(values.isValue(fixture('derived-result')), false, 'v2 recognizer requires immutable values');
});

test('S100m1 representation equality includes basis, method, arithmetic and estimate status', () => {
  const a = make(result());
  assert(values.sameValue(a, values.decodeValue(values.encodeValue(a))));
  for (const edit of [x=>x.data.methodId='other/v1',x=>x.data.estimateStatus='known',x=>x.data.arithmetic='approximate',x=>x.data.provenance.inputs[0].value.data.classes[0].upperClosed=false]) {
    const raw = result(); edit(raw);
    assert.equal(values.sameValue(a,make(raw)), false);
  }
});

test('S100m1 shape-valid invalid mathematics is representable without attestation', () => {
  const raw = group();
  raw.data.classes = [raw.data.classes[0]];
  raw.data.classes[0].upper = structuredClone(raw.data.classes[0].lower);
  raw.data.classes[0].count.data.expr.value = '0';
  const value = make(raw);
  assert(values.isValue(value));
  assert.equal(Object.hasOwn(value.data,'validated'),false);
});

test('S100m1 unknown encoding versions/kinds/variants reject; unknown methods stay opaque', () => {
  for (const edit of [x=>x.valueVersion=3,x=>x.kind='future-value',x=>x.data.variant='future-variant']) {
    const raw = group(); edit(raw);
    assert.throws(() => values.decodeValue(JSON.stringify(raw)), e=>e.diagnostic?.code==='unsupported-value-encoding');
  }
  const raw = result(); raw.data.methodId='unknown-method/v999999999999999999999999';
  assert.equal(make(raw).data.methodId,raw.data.methodId);
});

for (const [label,edit] of [
  ['missing field',x=>delete x.data.estimand],
  ['extra field',x=>x.data.schemaVersion=1],
  ['bad method',x=>x.data.methodId='median'],
  ['bad statistic',x=>x.data.statisticId='Median'],
  ['bad status',x=>x.data.estimateStatus='model-estimate'],
  ['duplicate assumptions',x=>x.data.assumptions.push(x.data.assumptions[0])],
  ['duplicate roles',x=>x.data.provenance.inputs.push(structuredClone(x.data.provenance.inputs[0]))],
  ['invalid role',x=>x.data.provenance.inputs[0].role='Data role'],
  ['empty provenance',x=>x.data.provenance.inputs=[]],
  ['non-v1 payload',x=>x.data.value=group()],
  ['invalid v1 payload',x=>x.data.value.data.expr={op:'unknown'}],
  ['v2 hidden under v1',x=>x.data.value={valueVersion:1,kind:'list',data:{items:[group()]}}],
  ['sparse input array',x=>delete x.data.provenance.inputs[0]],
]) test(`S100m1 strict rejection: ${label}`,()=>{const raw=result();edit(raw);rejected(raw);});

test('S100m1 safe graph validation rejects cycles, exotic properties and accessors without execution', () => {
  let calls=0;
  for (const edit of [
    x=>Object.defineProperty(x.data,'statisticId',{enumerable:true,get(){calls++;return 'mean';}}),
    x=>Object.defineProperty(x.data,'hidden',{value:1}),
    x=>{x.data[Symbol('hidden')]=1;},
    x=>{x.data.provenance.inputs[0].value=x;},
    x=>{x.data.assumptions.extra=1;},
    x=>{x.data.value=new Date();},
    x=>{x.data.assumptions=new (class extends Array {})();},
  ]) {const raw=result();edit(raw);rejected(raw);}
  assert.equal(calls,0);
});

test('S100m1 strict count and flags are structural, without Number conversion', () => {
  for(const edit of [x=>x.data.classes[0].count.data.expr.value='-1',x=>x.data.classes[0].count.data.expr.value='01',x=>x.data.classes[0].lowerClosed='false',x=>x.data.classes[0].lower.data.expr={op:'approx',value:'0.1'}]) {
    const raw=group();edit(raw);rejected(raw);
  }
});

test('S100m1 canonical bytes preserve non-ASCII v1 payload and v1 insertion order', () => {
  const raw=result();
  raw.data.value={kind:'expression',data:{expr:{name:'π',op:'constant'}},valueVersion:1};
  const value=make(raw);
  assert(values.encodeValue(value).endsWith('"value":{"kind":"expression","data":{"expr":{"name":"π","op":"constant"}},"valueVersion":1}}}'));
});

test('S100m1 resource policy rejects deep object/JSON before native recursion', () => {
  let deep=group();
  for(let i=0;i<1000;i++) deep={valueVersion:2,kind:'list',data:{items:[deep]}};
  resourceFailure(()=>make(deep),'depth');
  const prefix='{"valueVersion":2,"kind":"list","data":{"items":[';
  resourceFailure(()=>values.decodeValue(prefix.repeat(1000)+'0'+']}}'.repeat(1000)),'depth');
});

test('S100m1 exact depth boundary and generic v1 descendants are budgeted', () => {
  const raw=result();
  let expr={op:'integer',value:'1'};
  // result payload root depth 2, data depth 3, expr depth 4;
  // each pow.base adds one level; deepest leaf value is depth 128.
  for(let i=0;i<123;i++) expr={op:'pow',base:expr,exponent:{op:'integer',value:'1'}};
  raw.data.value={valueVersion:1,kind:'expression',data:{expr}};
  assert(values.isValue(make(raw)));
  raw.data.value.data.expr={op:'pow',base:expr,exponent:{op:'integer',value:'1'}};
  resourceFailure(()=>make(raw),'depth');
});

test('S100m1 breadth and shared DAG count expanded occurrences', () => {
  resourceFailure(()=>values.listV2(Array(100001).fill(null)),'nodes');
  let shared=group();
  for(let i=0;i<16;i++) shared={valueVersion:2,kind:'list',data:{items:[shared,shared]}};
  resourceFailure(()=>make(shared),'nodes');
});

test('S100m1 exactly 100000 nodes fit; the next complete typed item is rejected', () => {
  const one={valueVersion:1,kind:'expression',data:{expr:{op:'integer',value:'1'}}};
  const items=Array(14285).fill(one); // 5 container nodes + 14285*7 = 100000.
  const value=values.listV2(items);
  assert(values.isValue(values.decodeValue(values.encodeValue(value))));
  resourceFailure(()=>values.listV2([...items,one]),'nodes');
});

test('S100m1 UTF-8 byte budget is exact, including escaping and non-ASCII', () => {
  const raw=result(); raw.data.value={valueVersion:1,kind:'expression',data:{expr:{op:'constant',name:'x'}}};
  const base=Buffer.byteLength(JSON.stringify(raw));
  const length=limits['encoded-bytes']-base+1;
  raw.data.value.data.expr.name='x'.repeat(length);
  assert.equal(Buffer.byteLength(values.encodeValue(make(raw))),limits['encoded-bytes']);
  raw.data.value.data.expr.name+='x';
  resourceFailure(()=>make(raw),'encoded-bytes');
  raw.data.value.data.expr.name='π'.repeat(4*1024*1024);
  resourceFailure(()=>make(raw),'encoded-bytes');
  raw.data.value.data.expr.name='\u0000'.repeat(2*1024*1024);
  resourceFailure(()=>make(raw),'encoded-bytes');
});

test('S100m1 ingress ignores whitespace but preflights strings and wide JSON', () => {
  assert(values.isValue(values.decodeValue(' '.repeat(10000)+JSON.stringify(group()))));
  resourceFailure(()=>values.decodeValue('{"valueVersion":2,"kind":"list","data":{"items":['+'null,'.repeat(100001)+'null]}}'),'nodes');
  const raw=result(); raw.data.value.data.expr={op:'constant',name:'x'.repeat(8*1024*1024)};
  resourceFailure(()=>values.decodeValue(JSON.stringify(raw)),'encoded-bytes');
});

test('S100m1 diagnostic producers enforce parameters and their closed vocabularies', () => {
  assert.equal(Object.keys(VALUE_CODEC_DIAGNOSTIC_SPECS).length,3);
  for(const [code,parameters] of [
    ['invalid-value-encoding',{path:'/',reason:'made-up'}],
    ['unsupported-value-encoding',{path:'/',feature:'statistics-method',actual:'x',supported:['y']}],
    ['value-codec-resource-limit',{path:'/',resource:'statistics-size',limit:1}],
    ['value-codec-resource-limit',{path:'/',resource:'nodes',limit:1,extra:true}],
  ]) assert.throws(()=>valueCodecDiagnostic(code,parameters));
});

test('S100m1 pathological count strings and escaped/duplicate root version keys stay lossless', () => {
  const raw=group();raw.data.classes[0].count.data.expr.value='9'.repeat(10000);
  assert.equal(make(raw).data.classes[0].count.data.expr.value.length,10000);
  const serialized=JSON.stringify(group());
  assert.equal(values.encodeValue(values.decodeValue(serialized.replace('"valueVersion":2','"valueVersion":1,"valueVersion":2'))),serialized);
  assert.equal(values.encodeValue(values.decodeValue(serialized.replace('valueVersion','value\\u0056ersion'))),serialized);
  const revoked=Proxy.revocable({},{});revoked.revoke();
  assert.equal(values.isValue(revoked.proxy),false);
  for(const text of ['{"valueVersion":2,','{"valueVersion":2,"kind":"list","data":{"items":[NaN]}}'])
    assert.throws(()=>values.decodeValue(text),e=>e.diagnostic?.code==='invalid-value-encoding');
});
