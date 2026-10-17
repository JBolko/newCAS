import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {parse} from '../../src/js/parser.mjs';
import {Transformer} from '../../src/js/transformer.js';
import {compileLegacyQuantityUnit, compileLegacyConversionUnit} from '../../src/js/legacy/compile-legacy-unit.js';

const transformer = new Transformer({});
const compileSource = source => transformer.toPython(parse(source));

const supported = [
  ['5[m]', '(5 * m)'],
  ['3[kg*m/s^2]', '(3 * ((kg * m) / (s ** 2)))'],
  ['6[km/h]', '(6 * (km / h))'],
  ['8[min]', '(8 * minute)'],
  ['9[N]', '(9 * newton)'],
  ['2[g]', '(2 * gram)'],
  ['4[(kg*m)/s^2]', '(4 * (((kg * m)) / (s ** 2)))'],
  ['5[m^(-2)]', null], // exponent-parentheses unsupported; fail closed
];
for (const [source, expected] of supported) {
  test(`S87a legacy Quantity emits bounded syntax: ${source}`, () => {
    if (expected === null) assert.throws(() => compileSource(source), SyntaxError);
    else assert.equal(compileSource(source), expected);
  });
}

test('S87a legacy conversion targets are safely quoted and aliased', () => {
  assert.equal(compileLegacyConversionUnit(' min '), '"minute"');
  assert.equal(compileLegacyConversionUnit('km'), '"km"');
  assert.equal(compileLegacyConversionUnit('N'), '"newton"');
  assert.equal(compileSource('5[m] -> [cm]'), 'convert_to_unit((5 * m), "cm")');
  assert.throws(() => compileLegacyConversionUnit('km/h'), SyntaxError);
});

test('S87a legacy Quantity rejects attacker-supplied tokens without executing Python', () => {
  const payloads = [
    '__import__("os").getcwd()', 'm);import os;(1',
    'm.__class__', 'm+open("/etc/passwd")',
    'm\\x', 'globals()', 'm#comment', 'm\nimport os',
    'm[0]', 'm**2', 'm;1', 'm|1', 'm,kg',
    'constructor', 'toString', '__proto__', 'm^999999',
    'm^2.5', 'm^1e10', 'm^^2', 'm/(s', '',
  ];
  for (const value of payloads)
    assert.throws(() => compileLegacyQuantityUnit(value), SyntaxError, `accepted: ${JSON.stringify(value)}`);
  const wholeSources = [
    'x := 5 [__import__("os").getcwd()]',
    'x := 5 [m);import os;(1]',
    'y := 2 -> [km"+str(__import__("os").getcwd())+"]',
    'z := 1 -> [a"+open("/etc/passwd").read()+"]',
  ];
  for (const source of wholeSources)
    assert.throws(() => compileSource(source), {name:'SyntaxError'}, source);
});

test('S87a fail closed for non-string and unexpectedly deep/long units', () => {
  for (const input of [null, undefined, {}, ['m'], 'm'.repeat(129), '('.repeat(9)+'m'+')'.repeat(9)])
    assert.throws(() => compileLegacyQuantityUnit(input), SyntaxError);
  for (const input of [null, undefined, 'm/s', 'm+km', 'km\"+open(1)+\"', '__proto__'])
    assert.throws(() => compileLegacyConversionUnit(input), SyntaxError);
});

test('S87a P0021 never imports the retiring transformer/unit compiler', () => {
  const dirs = ['semantics', 'evaluation', 'values', 'operations', 'evaluator', 'diagnostics'];
  for (const dir of dirs) {
    for (const entry of readdirSync(`src/js/${dir}`, {withFileTypes:true})) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const path = `src/js/${dir}/${entry.name}`;
      const source = readFileSync(path, 'utf8');
      assert.doesNotMatch(source,
        /(?:from\s*['"][^'"]*(?:compile-legacy-unit|transformer|cas-engine)|import\s*\(['"][^'"]*(?:compile-legacy-unit|transformer|cas-engine))/, path);
    }
  }
});
