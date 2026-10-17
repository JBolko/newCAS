// Normative stress-tests på BINDINGSNIVEAU (ingen evaluering): hvilken blok binder hvert navn til?
// Tilfælde med `gap` er kendte huller (spec'en kræver noget andet end koden gør i dag).
import assert from 'node:assert/strict';
import {isFree} from './fixtures.mjs';

export const BINDING_CASES = [
  {id: '#1', title: 'nærmeste forgænger: b binder a1',
    blocks: [['a1', 'a := 4'], ['b', 'b := a+1'], ['a2', 'a := 7']],
    check: ({facts}) => assert.equal(facts.b.refs.a, 'a1')},
  {id: '#2', title: 'omdefinition før brug: b binder a2',
    blocks: [['a1', 'a := 4'], ['a2', 'a := 7'], ['b', 'b := a+1']],
    check: ({facts}) => assert.equal(facts.b.refs.a, 'a2')},
  {id: '#3', title: 'læs-før-skriv: a2 læser a1, b læser a2',
    blocks: [['a1', 'a := 4'], ['a2', 'a := a+1'], ['b', 'b := a']],
    check: ({facts}) => { assert.equal(facts.a2.refs.a, 'a1'); assert.equal(facts.b.refs.a, 'a2'); }},
  {id: '#4', title: 'ingen forgænger: a på højre side er et frit symbol',
    blocks: [['a', 'a := a+1']],
    check: ({facts}) => assert.ok(isFree(facts.a.refs.a), JSON.stringify(facts.a.refs))},
  {id: '#5', title: 'funktionskrop binder forudgående a1; kaldet binder f',
    blocks: [['a1', 'a := 4'], ['f', 'f(x) := a*x'], ['a2', 'a := 7'], ['c', 'f(2)']],
    check: ({facts}) => { assert.equal(facts.f.refs.a, 'a1'); assert.equal(facts.c.calls.f.providerId, 'f'); }},
  {id: '#6', title: 'fremadrettet a forbliver frit i funktionskroppen',
    blocks: [['f', 'f(x) := a*x'], ['a', 'a := 7'], ['c', 'f(2)']],
    check: ({facts}) => { assert.ok(isFree(facts.f.refs.a)); assert.equal(facts.c.calls.f.providerId, 'f'); }},
  {id: '#15', title: 'fejlet a2 (1/0) forbliver provider for b',
    blocks: [['a1', 'a := 4'], ['a2', 'a := 1/0'], ['b', 'b := a+1']],
    check: ({facts}) => assert.equal(facts.b.refs.a, 'a2')},
  {id: '#21', title: 'opgave-isolation: opgave 2 ser ikke opgave 1s a', task: 't2',
    blocks: [['a', 'a := 4', 't1'], ['b', 'b := a+1', 't2']],
    check: ({facts}) => { assert.ok(isFree(facts.b.refs.a)); assert.ok(facts.b.refs.a.includes('t2'), facts.b.refs.a); }},
  {id: '#24', title: 'slet a2 → X binder om til a1 (strukturel genbinding)',
    blocks: [['a1', 'a := 4'], ['a2', 'a := 7'], ['X', 'X := a']],
    act: rt => rt.removeBlock('a2'),
    check: ({before, facts}) => { assert.equal(before.X.refs.a, 'a2'); assert.equal(facts.X.refs.a, 'a1'); }},
  {id: '#26', title: 'flyt a2 før X → X binder om til a2; blok-id bevares',
    blocks: [['a1', 'a := 4'], ['X', 'X := a'], ['a2', 'a := 7']],
    act: rt => rt.moveBlock('a2', 1),
    check: ({before, facts, rt}) => {
      assert.equal(before.X.refs.a, 'a1');
      assert.equal(facts.X.refs.a, 'a2');
      assert.deepEqual(rt.blocks.map(b => b.id), ['a1', 'a2', 'X']);
    }},
  {id: '#37', title: 'A binder h1, B binder h2 (kaldbar)',
    blocks: [['h1', 'h(t) := t+1'], ['A', 'A := h(2)'], ['h2', 'h(t) := g(t)'], ['B', 'B := h(2)']],
    check: ({facts}) => { assert.equal(facts.A.calls.h.providerId, 'h1'); assert.equal(facts.B.calls.h.providerId, 'h2'); }},
  {id: '#38', title: 'slet fejlet h2 → B binder om til h1',
    blocks: [['h1', 'h(t) := t+1'], ['A', 'A := h(2)'], ['h2', 'h(t) := g(t)'], ['B', 'B := h(2)']],
    act: rt => rt.removeBlock('h2'),
    check: ({facts}) => assert.equal(facts.B.calls.h.providerId, 'h1')},
  {id: '#42', title: 'g i f er uløst (senere g binder ikke bagud)',
    blocks: [['f', 'f(x) := g(x)'], ['g', 'g(x) := x^2'], ['A', 'A := f(2)']],
    check: ({facts}) => {
      assert.equal(facts.f.calls.g.classification, 'unresolved');
      assert.equal(facts.f.calls.g.providerId, null);
    }},
  {id: '#43', title: 'fremadrettet y forbliver frit i f',
    blocks: [['f', 'f(x) := x+y'], ['y', 'y := 5'], ['A', 'A := f(2)']],
    check: ({facts}) => assert.ok(isFree(facts.f.refs.y))},
  {id: '#44', title: 'g := f binder f1; a kalder g; b kalder f2',
    blocks: [['f1', 'f(x) := x+1'], ['g', 'g := f'], ['f2', 'f(x) := x^2'], ['a', 'a := g(3)'], ['b', 'b := f(3)']],
    check: ({facts}) => {
      assert.equal(facts.g.refs.f, 'f1');
      assert.equal(facts.a.calls.g.providerId, 'g');
      assert.equal(facts.b.calls.f.providerId, 'f2');
    }},
  {id: '#46', title: 'f(3) binder seneste writer f2 (aritetsfejl opstår ved evaluering)',
    blocks: [['f1', 'f(x) := x^2'], ['f2', 'f(x,y) := x+y'], ['c', 'f(3)']],
    check: ({facts}) => assert.equal(facts.c.calls.f.providerId, 'f2')},
  {id: '#47', title: 'a læses af f; frit x i a er et frit symbol',
    blocks: [['a', 'a := x'], ['f', 'f(x) := a'], ['c', 'c := f(2)']],
    check: ({facts}) => { assert.equal(facts.f.refs.a, 'a'); assert.ok(isFree(facts.a.refs.x)); }},
  {id: '#54', title: 'samme uløste navn = samme frie symbol i A og B',
    blocks: [['A', 'A := x+1'], ['B', 'B := x+2'], ['C', 'C := A+B']],
    check: ({facts}) => { assert.ok(isFree(facts.A.refs.x)); assert.equal(facts.A.refs.x, facts.B.refs.x); }},

  // ── Kendte huller ────────────────────────────────────────────────────────────────────────────────
  {id: '#16', gap: 'F7', title: 'diff(x^2,x): symbolsk mål x må IKKE binde dokumentets x := 17',
    blocks: [['x', 'x := 17'], ['d', 'diff(x^2,x)']],
    check: ({facts}) => assert.notEqual(facts.d.refs.x, 'x',
      'x i diff(x^2,x) binder til dokumentets x := 17 → falsk afhængighedskant og falsk "blokeret" ved fejl')},
  {id: '#18', gap: 'F7', title: 'sum(k^2,k,1,3): dummy k må IKKE binde dokumentets k := 100',
    blocks: [['k', 'k := 100'], ['s', 'sum(k^2,k,1,3)']],
    check: ({facts}) => assert.notEqual(facts.s.refs.k, 'k', 'dummyvariablen k binder dokumentets k')},
];
