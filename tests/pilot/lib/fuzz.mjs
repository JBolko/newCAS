// Differentiel fuzz af arkitekturens centrale påstand:
//   resultatet afhænger kun af det AKTUELLE dokument, aldrig af redigeringshistorikken.
// Efter hver redigering gælder:
//   (1) ingen operation kaster                         ('throw')
//   (2) inkrementel genberegning == genberegning fra bunden ('divergence')
//   (3) en redigering i én opgave ændrer intet i de andre  ('isolation')
import {makeRuntime, evaluateAll, view, freshView} from './fixtures.mjs';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VARS = ['a', 'b', 'c'];
const FNS = ['f', 'g'];
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const num = rand => Math.floor(rand() * 6);

/** Gyldige énsætningskilder inden for de former, evaluatoren understøtter i dag. */
export function genValidSource(rand) {
  switch (Math.floor(rand() * 8)) {
    case 0: case 1: return `${pick(rand, VARS)} := ${num(rand)}`;
    case 2: return `${pick(rand, FNS)}(x) := x+${num(rand)}`;
    case 3: return `${pick(rand, FNS)}(x) := ${pick(rand, VARS)}*x`;
    case 4: return `${pick(rand, FNS)}(x) := x^2+${pick(rand, VARS)}`;
    case 5: return `${pick(rand, FNS)}(x) := x*x+${num(rand)}`;
    case 6: return `${pick(rand, FNS)}(${num(rand)})`;
    default: return `${pick(rand, FNS)}(${pick(rand, VARS)})`;
  }
}

/** Tekst en elev realistisk kan efterlade i en blok. Spec'en kræver, at et dokument kan rumme den. */
export const HOSTILE_SOURCES = [
  'a := 1; b := 2', 'a :=', 'a := )(', '', '   ', 'f(x) :=', 'a := 1\nb := 2',
  'x²', '1e3', 'A | a=7', 'sum(k^2,k,1,3)', '[1;2]', 'f(', ')', ':= 3', '5 [m]', 'ærlig := 3',
];
export function genHostileSource(rand) {
  return rand() < 0.5 ? pick(rand, HOSTILE_SOURCES) : genValidSource(rand);
}

export function applyOp(rt, op) {
  switch (op.t) {
    case 'add':
      if (!rt.getBlock(op.id)) rt.addBlock({id: op.id, type: 'formula', source: op.src, taskId: op.task});
      break;
    case 'ins':
      if (!rt.getBlock(op.id)) {
        rt.insertBlock({id: op.id, type: 'formula', source: op.src, taskId: op.task}, Math.min(op.i, rt.blocks.length));
      }
      break;
    case 'set': if (rt.getBlock(op.id)) rt.setBlockSource(op.id, op.src); break;
    case 'del': if (rt.getBlock(op.id)) rt.removeBlock(op.id); break;
    case 'mv': if (rt.getBlock(op.id) && rt.blocks.length > 0) rt.moveBlock(op.id, Math.min(op.i, rt.blocks.length - 1)); break;
    default: throw new Error(`ukendt op ${op.t}`);
  }
}

const touchedTask = (rt, op) => (op.t === 'add' || op.t === 'ins') ? op.task : rt.getBlock(op.id)?.taskId;

function diffText(a, b) {
  return Object.keys({...a, ...b}).filter(id => a[id] !== b[id])
    .map(id => `${id}: inkrementel=${String(a[id]).slice(0, 60)} | fra bunden=${String(b[id]).slice(0, 60)}`).join('; ');
}

/** Anvend én op, genberegn inkrementelt, kontroller (1)–(3). Returnerer null eller {reason, detail}. */
async function stepAndCheck(rt, op) {
  const task = touchedTask(rt, op);
  const before = view(rt);
  try {
    applyOp(rt, op);
    await evaluateAll(rt);
  } catch (error) {
    return {reason: 'throw', detail: `${op.t} ${op.id ?? ''} ${JSON.stringify(op.src ?? '')}: ${error.message}`};
  }
  const after = view(rt);
  let scratch;
  try { scratch = await freshView(rt); }
  catch (error) { return {reason: 'throw', detail: `genopbygning fra kilder: ${error.message}`}; }
  if (JSON.stringify(after) !== JSON.stringify(scratch)) return {reason: 'divergence', detail: diffText(after, scratch)};
  for (const b of rt.blocks) {
    if (b.taskId !== task && before[b.id] !== undefined && before[b.id] !== after[b.id]) {
      return {reason: 'isolation', detail: `redigering i opgave ${task} ændrede ${b.id} i ${b.taskId}`};
    }
  }
  return null;
}

/** Generér og kør én redigeringshistorie. Returnerer null (ok) eller {seed, step, reason, detail, ops}. */
export async function runSequence({seed, steps, hostile = false}) {
  const rand = mulberry32(seed);
  const gen = hostile ? genHostileSource : genValidSource;
  const rt = makeRuntime([]);
  const ops = [];
  let counter = 0;
  const task = () => (rand() < 0.7 ? 't1' : 't2');
  for (let i = 0; i < 6; i += 1) {
    const op = {t: 'add', id: `b${counter++}`, src: gen(rand), task: task()};
    ops.push(op);
    const bad = await stepAndCheck(rt, op);
    if (bad) return {seed, step: i, ...bad, ops: ops.slice()};
  }
  for (let step = 0; step < steps; step += 1) {
    const ids = rt.blocks.map(b => b.id);
    const x = rand();
    let op;
    if (x < 0.45 && ids.length) op = {t: 'set', id: pick(rand, ids), src: gen(rand)};
    else if (x < 0.65) op = {t: 'ins', id: `b${counter++}`, src: gen(rand), task: task(), i: Math.floor(rand() * (ids.length + 1))};
    else if (x < 0.80 && ids.length > 2) op = {t: 'del', id: pick(rand, ids)};
    else if (ids.length > 1) op = {t: 'mv', id: pick(rand, ids), i: Math.floor(rand() * ids.length)};
    else continue;
    ops.push(op);
    const bad = await stepAndCheck(rt, op);
    if (bad) return {seed, step: step + 6, ...bad, ops: ops.slice()};
  }
  return null;
}

/** Genafspil en opliste; returnerer reason ved første brud eller null. */
export async function replay(ops) {
  const rt = makeRuntime([]);
  for (const op of ops) {
    const bad = await stepAndCheck(rt, op);
    if (bad) return bad.reason;
  }
  return null;
}

/** Skrump en fejlende historie til en (næsten) minimal én. */
export async function shrink(ops, reason) {
  let current = ops.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const candidate = [...current.slice(0, i), ...current.slice(i + 1)];
      if (candidate.length && (await replay(candidate)) === reason) { current = candidate; changed = true; }
    }
  }
  return current;
}

export const describeOps = ops => ops.map(o => JSON.stringify(o)).join('\n    ');
