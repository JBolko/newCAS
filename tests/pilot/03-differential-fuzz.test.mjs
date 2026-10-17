// Arkitekturens centrale påstand: resultatet afhænger kun af det AKTUELLE dokument, ikke af historikken.
// Differentiel fuzz: inkrementel genberegning == genberegning fra bunden, efter HVER redigering.
//   PILOT_FUZZ_SEQS / PILOT_FUZZ_STEPS / PILOT_FUZZ_SEED justerer omfanget (standard 100 × 25, seed 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {runSequence, shrink, describeOps} from './lib/fuzz.mjs';

const SEQS = Number(process.env.PILOT_FUZZ_SEQS ?? 100);
const STEPS = Number(process.env.PILOT_FUZZ_STEPS ?? 25);
const SEED0 = Number(process.env.PILOT_FUZZ_SEED ?? 1);

async function fuzz({sequences, steps, hostile}) {
  for (let i = 0; i < sequences; i += 1) {
    const failure = await runSequence({seed: SEED0 + i, steps, hostile});
    if (failure) {
      const minimal = await shrink(failure.ops, failure.reason);
      assert.fail(`${failure.reason} (seed ${failure.seed}, trin ${failure.step}): ${failure.detail}\n`
        + `  minimal historie (${minimal.length} ops):\n    ${describeOps(minimal)}`);
    }
  }
}

test(`${SEQS} historier × ${STEPS} redigeringer (set/indsæt/slet/flyt, to opgaver): inkrementel == fra bunden, ingen kast, opgaver isolerede`,
  {timeout: 600_000}, () => fuzz({sequences: SEQS, steps: STEPS, hostile: false}));

test('[F1/F2] fuzz med realistiske, ufærdige og ugyldige kilder: dokumentet kan altid redigeres og er stadig == fra bunden',
  {timeout: 600_000}, () => fuzz({sequences: 30, steps: 15, hostile: true}));
