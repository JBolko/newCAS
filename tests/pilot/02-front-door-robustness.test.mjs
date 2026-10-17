// Findings F1 (ét tastetryk brinker dokumentet) og F2 (front-døren afviser parse-invalid tekst).
// Spec'en: en parse-invalid kilde er en del af dokumentet; den er blot ingen writer (#14, #41, §19).
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRuntime, evaluateAll, view} from './lib/fixtures.mjs';
import {HOSTILE_SOURCES} from './lib/fuzz.mjs';
// Former F1/F2 known gaps are now mandatory GREEN regression tests.
const confirmed = (finding, title, fn) => test(`[${finding}] ${title}`, fn);
import {none} from './lib/assertions.mjs';

const add = (rt, id, source, taskId = 'default') => rt.addBlock({id, type: 'formula', source, taskId});

// ── Grønne vagter ──────────────────────────────────────────────────────────────────────────────────────
test('front-døren accepterer en tom blok (en ny blok er tom, indtil eleven skriver)', () => {
  const rt = makeRuntime([['a', 'a := 1'], ['e', ''], ['b', 'b := a']]);
  assert.ok(rt.getBlock('e'));
});

// ── F2 (LIVE I DAG): en tom/ugyldig blok stopper evalueringen af HELE opgaven ─────────────────────────────
// prepare-semantic-evaluation-batch.js kaster 'cannot evaluate syntactically invalid block' for ÉN blok med
// parseError – ikke kun for den blok. Spec #14: en ugyldig blok bidrager ingen writer; de andre skal evalueres.
for (const [label, source] of [['tom blok', ''], ['blok med kun mellemrum', '   ']]) {
  confirmed('F2', `${label} forhindrer ikke evaluering af resten af opgaven`, async () => {
    const rt = makeRuntime([['a', 'a := 1'], ['e', source], ['b', 'b := 2']]);
    await assert.doesNotReject(() => evaluateAll(rt), 'evalueringen af opgaven kaster pga. den tomme blok');
    const v = view(rt);
    assert.ok(v.a.startsWith('success:') && v.b.startsWith('success:'), `a og b skal beregnes: ${JSON.stringify(v)}`);
    assert.ok(!v.e.startsWith('success:'), 'den tomme blok må ikke have en værdi');
  });
}

// ── F2: front-døren ───────────────────────────────────────────────────────────────────────────────────
confirmed('F2', 'addBlock accepterer parse-invalid kilde (a :=) og blokken står i dokumentet', () => {
  const rt = makeRuntime([['a1', 'a := 4']]);
  assert.doesNotThrow(() => add(rt, 'bad', 'a :='));
  assert.ok(rt.getBlock('bad'), 'blokken skal findes (kilden er autoritativ, også når den ikke kan parses)');
});

confirmed('F2', 'dokument med ufærdig linje kan indlæses: b binder stadig første a (#14)', async () => {
  const rt = makeRuntime([['a1', 'a := 4'], ['bad', 'a :='], ['b', 'b := a+1']]);
  const {facts} = (await import('./lib/fixtures.mjs')).bindingFacts(rt);
  assert.equal(facts.b.refs.a, 'a1');
});

confirmed('F2', 'setBlockSource accepterer parse-invalid tekst (elev gemmer midt i en linje)', () => {
  const rt = makeRuntime([['a1', 'a := 4'], ['a2', 'a := 7'], ['b', 'b := a']]);
  assert.doesNotThrow(() => rt.setBlockSource('a2', 'a :='));
  assert.equal(rt.getBlock('a2').source, 'a :=', 'kilden skal være gemt som skrevet');
});

confirmed('F2', 'ethvert tegnsekvens kan stå i en blok uden at ødelægge dokumentet (egenskab)', () => {
  const failures = [];
  for (const source of HOSTILE_SOURCES) {
    const rt = makeRuntime([['ok', 'x := 1']]);
    try {
      add(rt, 'h', source);
      rt.deriveSemanticTask('default');
      rt.setBlockSource('ok', 'x := 2');
    } catch (error) {
      failures.push(`${JSON.stringify(source)} → ${String(error.message).slice(0, 70)}`);
    }
  }
  none(failures, `${failures.length} af ${HOSTILE_SOURCES.length} tekster gør blokken/dokumentet ubrugeligt:`);
});

// ── F1: én blok med to sætninger forgifter hele dokumentet ──────────────────────────────────────────────
const poisoned = () => makeRuntime([
  ['x', 'x := 1'], ['two', 'a := 1; b := 2'], ['y', 'y := x'], ['q', 'q := 1', 't2'],
]);

confirmed('F1', 'efter "a := 1; b := 2" kan en UAFHÆNGIG blok stadig redigeres', () => {
  assert.doesNotThrow(() => poisoned().setBlockSource('y', 'y := 5'));
});
confirmed('F1', '…og den skyldige blok kan RETTES', () => {
  assert.doesNotThrow(() => poisoned().setBlockSource('two', 'a := 1'));
});
confirmed('F1', '…og den skyldige blok kan SLETTES', () => {
  assert.doesNotThrow(() => poisoned().removeBlock('two'));
});
confirmed('F1', '…og blokke i en ANDEN opgave kan redigeres', () => {
  assert.doesNotThrow(() => poisoned().setBlockSource('q', 'q := 2'));
});
confirmed('F1', '…og blokke kan flyttes og indsættes', () => {
  const rt = poisoned();
  assert.doesNotThrow(() => rt.moveBlock('y', 0));
  assert.doesNotThrow(() => rt.insertBlock({id: 'z', type: 'formula', source: 'z := 2', taskId: 'default'}, 0));
});
confirmed('F1', 'semantisk afledning er total: deriveSemanticTask kaster aldrig for tekst, der kan parses', () => {
  const parsable = ['a := 1; b := 2', 'x', '2+3', 'x = 2', '[1;2]', 'f(1;5)', 'a := 1; 2', 'diff(x^2,x)', 'f(x) := x; g(x) := x'];
  const failures = [];
  for (const source of parsable) {
    const rt = makeRuntime([['ok', 'x := 1']]);
    try { add(rt, 'h', source); rt.deriveSemanticTask('default'); }
    catch (error) { failures.push(`${JSON.stringify(source)} → ${String(error.message).slice(0, 70)}`); }
  }
  none(failures, 'afledningen kaster for tekst, der kan parses:');
});

confirmed('F1', 'setBlockSource er atomisk: kaster den, er kilden uændret; ændres kilden, er downstream ikke længere "success"', async () => {
  const rt = makeRuntime([['x', 'x := 1'], ['y', 'y := x'], ['z', 'z := y']]);
  await evaluateAll(rt);
  assert.ok(Object.values(view(rt)).every(v => v.startsWith('success:')), 'forudsætning: alt beregnet');
  let threw = false;
  try { rt.setBlockSource('x', 'x := 2; w := 3'); } catch { threw = true; }
  const changed = rt.getBlock('x').source !== 'x := 1';
  if (threw) assert.equal(changed, false, 'setBlockSource kastede, men kilden er ændret alligevel (ikke atomisk)');
  if (changed) {
    const stale = ['y', 'z'].filter(id => rt.getBlock(id).calculation.status === 'success');
    none(stale, 'forældede success-resultater beregnet på den GAMLE x:');
  }
});
