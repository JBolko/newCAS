// F3: er src/js/parser.mjs (genereret) i sync med docs/Grammatik.pegjs (kilden)?
// F8: sprog- og præcisionshuller (`|`-substitution, 1e3, tab af cifre i literaler).
// F4 (grammatikdelen): enhedsreglen accepterer alle tegn undtagen `]`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {repoPath} from './lib/paths.mjs';
import {knownGap} from './lib/gaps.mjs';
import {none} from './lib/assertions.mjs';
import {parse} from '../../src/js/parser.mjs';

let peggy = null;
try { peggy = (await import('peggy')).default; } catch { /* devDependency ikke installeret */ }

const PROBES = [
  'x := 4', 'f(x) := x^2+1', 'f(2)', 'f(1;5)', 'x := 0.5', 'x := 0,5', 'f(1,5)', '[1,5]', '[1;5]',
  'binompdf(2;10;0,5)', 'sum(k^2,k,1,3)', 'a := 1; b := 2', 'x := 5 [m]', 'y := 2 -> [km]',
  'x = 2', 'x < 3', "f'(x)", 'A*v', 'x := 1e3',
];
const stripLocation = (key, value) => (key === 'location' ? undefined : value);
const astOf = (parser, source) => {
  try { return JSON.stringify(parser.parse(source), stripLocation); }
  catch (error) { return `PARSEFEJL: ${String(error.message).slice(0, 60)}`; }
};

async function regeneratedParser() {
  const grammar = readFileSync(repoPath('docs', 'Grammatik.pegjs'), 'utf8');
  const source = peggy.generate(grammar, {output: 'source', format: 'es', cache: true});
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

// ── F3 ────────────────────────────────────────────────────────────────────────────────────────────────
if (!peggy) {
  test('F3 parser-sync', {skip: 'peggy er ikke installeret (npm install)'}, () => {});
} else {
  test('[F3] src/js/parser.mjs giver samme AST som en parser genereret fra docs/Grammatik.pegjs', async () => {
    const generated = await regeneratedParser();
    const differing = PROBES.filter(s => astOf({parse}, s) !== astOf(generated, s)).map(s =>
      `${JSON.stringify(s)}\n      parser.mjs : ${astOf({parse}, s).slice(0, 110)}\n      .pegjs     : ${astOf(generated, s).slice(0, 110)}`);
    none(differing, `${differing.length} af ${PROBES.length} prøver giver forskellig AST (to forskellige sprog i repoet):`);
  });
}

// ── F8 ────────────────────────────────────────────────────────────────────────────────────────────────
knownGap('F8', 'substitution `udtryk | a=7` kan parses (stress-test #7, #8, #39, #45)', () => {
  for (const source of ['f(2) | a=7', 'A | a=10', 'f | x=2']) {
    assert.doesNotThrow(() => parse(source), `"${source}" kan ikke parses – grammatikken har ingen |-operator`);
  }
});

knownGap('F8', '1e3 tolkes ikke stille som 1*e3 (fejl eller rigtig videnskabelig notation)', () => {
  let ast;
  try { ast = parse('x := 1e3'); } catch { return; }
  const v = ast[0].value;
  const silent = v?.type === 'BinaryExpression' && v.right?.type === 'Variable' && v.right.name === 'e3';
  assert.ok(!silent, '1e3 blev til produktet 1*e3 uden varsel');
});

knownGap('F8', 'literaler bevarer deres tekst – ingen stille tab af cifre (grundlag for eksakte decimaler)', () => {
  const digits = '12345678901234567890';
  const ast = parse(`x := 0.${digits}`);
  assert.ok(JSON.stringify(ast).includes(digits),
    `AST bærer kun ${JSON.stringify(ast[0].value)} – cifrene ud over ~17 betydende er tabt ved parsing`);
});

test('pinnet: ";" i én blok giver to sætninger (udløser for F1)', () => {
  assert.equal(parse('a := 1; b := 2').length, 2);
});

// ── F4 (grammatikdelen) ──────────────────────────────────────────────────────────────────────────────
knownGap('F4', 'enhedsreglen afviser tegn, der ikke kan indgå i en enhed – men tillader rigtige enheder', () => {
  for (const unit of ['m', 'm/s^2', 'kg*m/s^2', 'km/h', 'mol/L', 'N']) {
    assert.doesNotThrow(() => parse(`x := 5 [${unit}]`), `lovlig enhed [${unit}] skal kunne parses`);
  }
  const hostile = [
    'x := 5 [__import__("os").getcwd()]', 'x := 5 [m);import os;(1]', 'x := 5 [m"]', 'y := 1 -> [km"+str(1)+"]',
  ];
  const accepted = hostile.filter(source => { try { parse(source); return true; } catch { return false; } });
  none(accepted, 'enhedsfeltet accepterer vilkårlig tekst, der senere indsættes i Python-kode:');
});
