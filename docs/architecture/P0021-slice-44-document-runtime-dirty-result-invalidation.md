# P0021 Slice 44 — invalidér forældede DocumentRuntime-resultater

**Dato:** 13. oktober 2026
**Status:** lokal GREEN; fuld Node 24-regression afventer brugerens checkout.

## Observation (RED)

Den eksisterende `DocumentRuntime.markBlockDirty` hævede generation og satte `status: dirty`, men beholdt `calculation.result` og `calculation.error`. En tidligere succesværdi kunne dermed fortsat læses som en aktuel værdi efter strukturelle ændringer. Den gamle test `markBlockDirty preserves previous result` kodificerede netop denne forkerte forventning.

## Ændring (GREEN)

`markBlockDirty` erstatter nu den afledte beregningstilstand atomisk med `{status: 'dirty', generation: old + 1, result: null, error: null}`. Eksisterende generationstjek i `calculateBlock` afviser sent returnerende beregninger fra en ældre generation. Ved uændrede, irrelevante blokke bevares resultatet; en `idle`/allerede `dirty` blok behandles som tidligere.

## Tests

Fem nye tests kontrollerer sletning af forudgående definition, indsættelse af nærmere definition, nulstilling af gamle diagnostikker, forsinket resultat og bevarelse af upåvirket resultat. En eksisterende test opdateres eksplicit fra "preserve" til "clear"; den eksisterende recalculation-test opretholder forventningen om et nyt succesresultat. 76/76 målrettede tests grønne lokalt.

## Grænse og næste skridt

Dette er en nødvendig sikkerhedsrettelse i den **eksisterende legacy DocumentRuntime**. Den udfører fortsat nogle beregninger via `CASEngine`; den nye semantiske batch er **ikke** endnu fuldt integreret her. Næste arbejde er at udskifte den autoritative beregningsvej med P0020/P0021-snapshot, provider-Values og revisionsstyret batch, uden en parallelt ejet dokumenttilstand. P0018's i18n RED-probe er uberørt.
