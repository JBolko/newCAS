// Hjælpere til at gøre KENDTE HULLER eksekverbare uden at gøre suiten rød.
//
//   knownGap('F1', 'navn', async () => { ...assert... })
//
// Standard: testen KØRER, men markeres som node:test "todo" – en fejl tæller ikke mod exit-koden,
//           men står tydeligt som "# TODO" i rapporten. Når testen begynder at bestå, skriver
//           den "HUL LUKKET" som diagnostik, så wrapperen kan fjernes.
// PILOT_STRICT=1: huller er rigtige fejl (brug det til at måle fremdrift / som exit-kriterie).
// PILOT_SLOW=1  : slår langsomme tests til (hængende beregninger, respawn af Worker m.m.).
import test from 'node:test';

export const STRICT = process.env.PILOT_STRICT === '1';
export const SLOW = process.env.PILOT_SLOW === '1';

export function knownGap(finding, name, fn, options = {}) {
  const title = `[${finding}] ${name}`;
  const opts = STRICT ? {...options} : {...options, todo: `kendt hul ${finding}`};
  return test(title, opts, async (t) => {
    await fn(t);
    if (!STRICT) t.diagnostic(`HUL LUKKET: "${title}" består nu – fjern knownGap-wrapperen`);
  });
}

export function slow(name, fn, options = {}) {
  return test(name, {...options, skip: SLOW ? false : 'langsom – sæt PILOT_SLOW=1'}, fn);
}

export function slowGap(finding, name, fn, options = {}) {
  const title = `[${finding}] ${name}`;
  const opts = {...options, skip: SLOW ? false : 'langsom – sæt PILOT_SLOW=1'};
  if (!STRICT) opts.todo = `kendt hul ${finding}`;
  return test(title, opts, async (t) => {
    await fn(t);
    if (!STRICT) t.diagnostic(`HUL LUKKET: "${title}" består nu – fjern slowGap-wrapperen`);
  });
}
