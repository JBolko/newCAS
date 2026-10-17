// F4: den gamle vej bygger Python-kode som tekst ud fra elevens input og kører den med exec/eval.
// Testen GENERERER kun kode (kører den aldrig) og tjekker, at elevtekst ikke kan blive til Python-syntaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {repoPath} from './lib/paths.mjs';
import {none} from './lib/assertions.mjs';
import {parse} from '../../src/js/parser.mjs';
import {Transformer} from '../../src/js/transformer.js';

const HOSTILE = [
  'x := 5 [__import__("os").getcwd()]',
  'x := 5 [m);import os;(1]',
  'y := 2 -> [km"+str(__import__("os").getcwd())+"]',
  'z := 1 -> [a"+open("/etc/passwd").read()+"]',
];
const DANGEROUS = /__|\bimport\b|\bexec\s*\(|\beval\s*\(|\bopen\s*\(|getattr|globals|\bcompile\s*\(|\bos\./;

test('[F4] elevtekst i enhedsfelter kan ikke blive til Python-kode i den gamle transformer', () => {
  const leaked = [];
  for (const source of HOSTILE) {
    let code;
    try { code = new Transformer({}).toPython(parse(source)); }
    catch { continue; } // afvist ved parsing/oversættelse = sikkert
    if (DANGEROUS.test(code)) leaked.push(`${JSON.stringify(source)}\n      → ${code}`);
  }
  none(leaked, 'farlig kode genereret fra elevtekst:');
});

// ── Grøn vagt: den NYE vej må aldrig få dynamisk kodeudførelse ──────────────────────────────────────────
function listFiles(dir, extensions) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, extensions));
    else if (extensions.some(ext => entry.endsWith(ext))) out.push(full);
  }
  return out;
}
const withoutComments = (text, lineComment) => text.split('\n').filter(l => !l.trim().startsWith(lineComment)).join('\n');

test('vagt: Python i den nye vej (evaluator/, adapters/) har ingen eval/exec/compile/__import__/sympify/parse_expr', () => {
  const files = [...listFiles(repoPath('src', 'python', 'evaluator'), ['.py']), ...listFiles(repoPath('src', 'python', 'adapters'), ['.py'])];
  assert.ok(files.length > 5, 'forventede at finde den nye vejs Python-filer');
  const bad = [];
  for (const file of files) {
    const text = withoutComments(readFileSync(file, 'utf8'), '#');
    const m = /\b(eval|exec|compile)\s*\(|__import__|importlib|\bsympify\s*\(|parse_expr/.exec(text);
    if (m) bad.push(`${path.relative(repoPath(), file)}: ${m[0]}`);
  }
  none(bad, 'dynamisk kodeudførelse i den nye vej:');
});

test('vagt: JS i den nye vej (evaluation/, semantics/, values/, operations/) bruger hverken eval() eller new Function()', () => {
  const dirs = ['evaluation', 'semantics', 'values', 'operations'].map(d => repoPath('src', 'js', d));
  const bad = [];
  for (const file of dirs.flatMap(d => listFiles(d, ['.js']))) {
    const text = withoutComments(readFileSync(file, 'utf8'), '//');
    if (/\beval\s*\(|new Function\s*\(/.test(text)) bad.push(path.relative(repoPath(), file));
  }
  none(bad, 'eval()/new Function() i den nye vej:');
});

test('info: hvor findes der eval/exec i Python i dag (den gamle vejs angrebsflade)?', (t) => {
  const hits = listFiles(repoPath('src', 'python'), ['.py'])
    .filter(f => /\b(eval|exec)\s*\(/.test(withoutComments(readFileSync(f, 'utf8'), '#')))
    .map(f => path.relative(repoPath(), f));
  t.diagnostic(`filer med eval/exec: ${hits.join(', ') || '(ingen)'}`);
  assert.ok(Array.isArray(hits));
});
