/** P0021 Slice 91a: canonical parser speed without a second grammar or evaluator.
 * The parser is a generated artifact. Build in --write mode before running tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import peggy from 'peggy';
import {parse} from '../../src/js/parser.mjs';

const grammar = readFileSync(new URL('../../docs/Grammatik.pegjs', import.meta.url), 'utf8');
const reference = peggy.generate(grammar, {cache: false});
const cachedReference = peggy.generate(grammar, {cache: true});

function outcome(parser, input) {
  try { return {ok: true, ast: parser.parse(input)}; }
  catch (error) { return {ok: false, name: error.name, message: error.message}; }
}

test('S91a: packrat does not change the AST or syntax diagnostics of representative sources', () => {
  const corpus = [
    '42', '0.5', 'a := 1', 'x :=', 'a := )(', 'f(x):=x^2', 'f(f(2))',
    'a := 1; b := a+2; a := 5; resultat := a b',
    'f(1,5)', 'f(1;5)', '[1;2;3]', '3.5[kg*m/s^2]',
    'diff(x^2,x)', "f'(x)", '2x(3+x)', 'x := 1e3', 'x := 0,5',
    'f('.repeat(4) + '1' + ')'.repeat(4), '(f('.repeat(3) + '1',
  ];
  // Deterministic small malformed-source corpus: no arbitrary timeouts or flaky randomness.
  const tokens = ['a','f','1','2','+','-','*',';',',','(',')','[',']','x',':=',' ','0.5'];
  let state = 0x5EED1234;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  for (let i = 0; i < 300; i += 1) {
    const size = 1 + next() % 5;
    let s = '';
    for (let j = 0; j < size; j += 1) s += tokens[next() % tokens.length];
    corpus.push(s);
  }
  for (const source of corpus) {
    assert.deepEqual(outcome({parse}, source), outcome(reference, source), source);
    assert.deepEqual(outcome(cachedReference, source), outcome(reference, source), source);
  }
});

test('S91a: deeply nested valid and incomplete input returns promptly in an isolated process', () => {
  // A subprocess lets the gate fail rather than freezing `node --test` on a bad parser.
  const parserUrl = new URL('../../src/js/parser.mjs', import.meta.url).href;
  const code = `
    import {parse} from ${JSON.stringify(parserUrl)};
    const cases = [
      ['f('.repeat(40) + '1' + ')'.repeat(40), true],
      ['('.repeat(70) + '1' + ')'.repeat(70), true],
      ['f('.repeat(70) + '1' + ')'.repeat(70), true],
      ['(f('.repeat(15) + '1', false]
    ];
    let count = 0;
    for (const [input, valid] of cases) {
      let accepted;
      try { parse(input); accepted = true; } catch { accepted = false; }
      if (accepted !== valid) throw Error('wrong parse outcome for case ' + count);
      count++;
    }
    console.log('parsed', count);
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', timeout: 4000,
    // Keep the numeric console output stable even if the parent forces colors.
    env: {...process.env, FORCE_COLOR: '0'},
  });
  assert.equal(child.error?.code, undefined,
    `parser stalled beyond subprocess timeout: ${child.error?.message}`);
  assert.equal(child.signal, null, `parser terminated by ${child.signal}`);
  assert.equal(child.status, 0, `${child.stderr ?? ''}\n${child.stdout ?? ''}`);
  assert.match(child.stdout, /parsed 4/);
});

test('S91a: canonical decimal point and statement delimiters remain unchanged', () => {
  assert.deepEqual(parse('f(1,5)')[0].args.map(arg => arg.value), [1,5]);
  assert.throws(() => parse('x := 0,5'));
  const ast = parse('a:=1; b:=3; resultat:=a b');
  assert.equal(ast.length, 3);
  assert.equal(ast[2].value.op, '*');
});
