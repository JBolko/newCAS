# newCAS - Developer Tools

Dette dokument beskriver den aktuelle developer-tooling-baseline for newCAS efter P01-P06.

Formålet med værktøjerne er at gøre arkitektur, runtime-kontrakter og projektstatus synlige og automatisk kontrollerbare, så udvikling kan fortsætte sikkert efter ændringer eller længere pauser.

## 1. Standardkommandoer

### Build og arkitekturkontrol

```powershell
npm run tools:build
```

Build-driveren kører de centrale analyser i rækkefølge og stopper ved fejl. Den opdaterer samtidig de genererede rapporter og den maskinafledte arkitekturdokumentation.

Den aktuelle kæde er:

1. Module Graph
2. Layer Guard
3. Runtime Report
4. AST Report
5. Documentation Generator

Et grønt build betyder, at de kontrollerede arkitektur- og runtime-kontrakter er konsistente på build-tidspunktet.

### Doctor

```powershell
npm run tools:doctor
```

Doctor er en read-only kontrol af den aktuelle udviklingsinstallation og projektstatus. Doctor reparerer eller genererer ikke filer.

Doctor kontrollerer:

- Python, Node og npm
- nødvendige projektfiler
- genererede rapporter og arkitekturdokumentation
- Registry -> BASE_CONTEXT-konsistens
- beskyttelse af offentlige symboler
- Parser -> Transformer-konsistens
- Transformer -> parser-case-dækning

Et grønt Doctor-resultat betyder, at det installerede udviklingsmiljø og de eksisterende rapporter ser sunde ud.

Doctor kontrollerer i denne version ikke, om en rapport er nyere end den kildekode, den blev genereret fra. Kør `npm run tools:build`, når rapporterne skal regenereres fra den aktuelle kode.

## 2. Enkeltværktøjer

### Layer Guard

```powershell
npm run tools:layer
```

Kontrollerer Python-modulernes interne afhængigheder mod den definerede lagpolitik.

Politikken ligger i:

```text
tools/policy/layer_policy.json
```

### Runtime Report

```powershell
npm run tools:runtime
```

Analyserer den offentlige newCAS-runtime og skriver:

```text
tools/reports/runtime.json
```

Rapporten beskriver blandt andet de offentlige registry-symboler, `BASE_CONTEXT`, beskyttede symboler og konsistensen mellem disse.

`cas_math/registry.py` er autoritativ for newCAS' offentlige CAS-funktioner. Hele `BASE_CONTEXT` er ikke automatisk en del af det understøttede offentlige API.

### AST Report

```powershell
npm run tools:ast
```

Parser de definerede syntakscases med den genererede parser og sammenholder de observerede AST-node-typer med Transformerens understøttede node-typer.

Rapporten skrives til:

```text
tools/reports/ast.json
```

Kontrollen går begge veje:

- Parser-node-typer skal være understøttet af Transformer.
- Transformer-node-typer skal være dækket af parser-cases.

Den autoritative grammatikkilde er:

```text
docs/Grammatik.pegjs
```

Den genererede parser er:

```text
src/js/parser.mjs
```

## 3. Genereret dokumentation

`npm run tools:build` genererer:

```text
docs/generated/ARCHITECTURE_REPORT.md
```

Filen indeholder maskinafledte facts fra de aktuelle analyser og må ikke redigeres manuelt.

Skellet er:

```text
Styredokumenter og ADR'er   -> menneskeskrevne beslutninger, rationale og roadmap
docs/generated/            -> maskinafledte facts fra kode og analyser
```

Den overordnede autoritets- og synkroniseringspolitik er beskrevet i:

```text
docs/Styredokumenter/SYNC_POLICY.md
```

## 4. Anbefalet arbejdsgang

Ved normal udvikling:

```text
ændr kode
   |
   v
kør relevante tests
   |
   v
npm run tools:build
   |
   v
npm run tools:doctor
   |
   v
git status
   |
   v
commit
```

Efter en længere pause, et `git pull` eller skift til en anden computer kan `npm run tools:doctor` bruges som hurtig første kontrol af udviklingsmiljøet.

## 5. Developer-tooling baseline P01-P06

Den aktuelle baseline består af:

| Fase | Værktøj | Formål |
| --- | --- | --- |
| P01 | Module Graph | Kortlægger Python-moduler og afhængigheder |
| P02 | Layer Guard | Håndhæver tilladte arkitekturlag |
| P03 | Runtime Report | Sammenholder registry og faktisk runtime-context |
| P04 | AST Report | Kontrollerer Parser <-> AST <-> Transformer |
| P05 | Documentation Generator | Genererer maskinafledt arkitekturdokumentation |
| P06 | Doctor | Read-only health check af udviklingsmiljø og rapporteret projektstatus |

P01-P06 udgør tilsammen sikkerhedsnettet omkring den videre udvikling af selve newCAS.

## 6. Principper

Developer-værktøjerne skal følge disse principper:

- Source of truth skal være tydelig.
- Maskinafledte facts skal så vidt muligt genereres frem for manuelt kopieres.
- Kontroller skal fejle tydeligt ved kontraktbrud.
- Doctor skal være sikker at køre og må ikke reparere projektet automatisk.
- Generated files må ikke bruges som erstatning for arkitekturbeslutninger og ADR'er.
- Værktøjerne skal støtte udviklingen af newCAS, ikke blive et mål i sig selv.
