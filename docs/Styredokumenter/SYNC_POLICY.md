# newCAS - Sync-politik

Formålet er at gøre projektet let at genoptage efter lange pauser og at gøre det tydeligt, hvilke filer der er autoritative, hvilke der er afledte, og hvilke der må redigeres manuelt.

## Autoritetsrækkefølge

```text
docs/Grammatik.pegjs       -> syntaks
cas_math/registry.py        -> offentlige newCAS-funktioner
cas_math/*.py               -> implementation
output/result.py            -> JSON for succesfulde resultater
output/errors.py            -> fejlkontrakt
tests/E2E                   -> testbekræftet adfærd
Styredokumenter og ADR'er   -> forklaring, beslutninger og roadmap
```

`src/js/parser.mjs` er genereret fra `docs/Grammatik.pegjs` og er derfor ikke source of truth for syntaksen.

## Menneskeskrevet og genereret dokumentation

newCAS skelner mellem to typer dokumentation.

### Menneskeskrevet dokumentation

`docs/Styredokumenter/` og `docs/adr/` indeholder arkitekturbeslutninger, begrundelser, kontrakter, roadmap og anden dokumentation, hvor menneskelig kontekst er nødvendig.

Disse filer redigeres manuelt.

### Genereret dokumentation

`docs/generated/` indeholder maskinafledte fakta om den aktuelle kodebase.

Filer i denne mappe må **ikke redigeres manuelt**. De regenereres af developer-værktøjerne.

Aktuelt genereres:

```text
docs/generated/ARCHITECTURE_REPORT.md
```

Rapporten bygger på analyserne i `tools/reports/`, herunder runtime- og AST-rapporterne.

Den genererede dokumentation kan beskrive fakta som:

- antal offentlige newCAS-symboler
- størrelse på `BASE_CONTEXT`
- beskyttede symboler
- AST-node-typer
- parser/transformer-konsistens
- registry/runtime-konsistens

Den genererede dokumentation må ikke bruges som sted for arkitekturbeslutninger eller begrundelser. Disse hører hjemme i styredokumenter og ADR'er.

## Build og synkronisering

Den normale arkitekturkontrol køres med:

```text
npm run tools:build
```

Build-driveren kører analyseværktøjerne først og genererer derefter dokumentationen ud fra de nye rapporter.

Det betyder, at rækkefølgen principielt er:

```text
kildekode
   ↓
analyseværktøjer
   ↓
tools/reports/*.json
   ↓
docs/generated/*.md
```

Hvis buildet fejler, skal den genererede dokumentation ikke betragtes som bekræftet aktuel dokumentation.

## Nye CAS-funktioner

Tilføjelse sker i fire trin:

1. implementér i relevant `cas_math`-modul
2. registrér i `registry.py`
3. skriv isoleret test og E2E-test
4. opdatér funktionskataloget

Grammatikken ændres kun, når **syntaksen** ændres.

## Parser og Transformer

Parserens AST og Transformerens understøttede node-typer kontrolleres automatisk af AST-rapporten.

Buildet skal fejle, hvis:

- parseren producerer en testdækket AST-node, som Transformeren ikke understøtter
- Transformeren understøtter en AST-node, som ikke er dækket af parserens AST-cases
- en AST-case ikke producerer den forventede node-type

## Runtime

Runtime-rapporten kontrollerer sammenhængen mellem det offentlige registry og den faktiske runtime-context.

Det offentlige registry er newCAS' understøttede API. Symboler, som findes i `BASE_CONTEXT` alene, er ikke dermed en del af det offentlige newCAS-API.

## JSON

`type` og feltnavne behandles som API-kontrakter.

Feltet `decimal` er historisk navngivet og er en **displaystreng**. Den er ikke garanteret at indeholde ét numerisk tal; symbolske, komplekse og liste-resultater kan også have tekstlig repræsentation her. Frontend'en skal dispatch'e på `type` og må ikke generelt kalde `parseFloat()` på `decimal`.

## Roadmap

En feature må kun være markeret færdig, hvis der findes tests, der dokumenterer den faktiske adfærd.

## Snapshot-regel

Dokumentation skrevet ud fra et Repomix-snapshot må ikke fremstille ikke-leverede filer som verificeret kode.

Når den aktuelle fil eller kode er tilgængelig, har den forrang frem for ældre snapshots og tidligere dokumentationsantagelser.
