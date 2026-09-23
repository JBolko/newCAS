# newCAS - Aktuel arkitektur og interfaces

**Snapshot-status:** 23. september 2026. Dokumentet beskriver den aktuelle arkitektur gennem P07.11, herunder Document Runtime, reaktive beregninger og strukturelle dokumentmutationer.

## 1. Arkitektur i én figur

```text
Editor / UI
    |
    v
Document Runtime
    |  source + document order + dependencies + calculation state
    v
Peggy parser
    |  AST (JavaScript-objekt)
    v
Transformer
    |  Python-kode (streng)
    v
CASEngine / Pyodide
    |
    v
core.executor.run_in_task(task_id, code)
    |
    +--> core.scope       task-scope + auto-symboler
    +--> core.context     base-context
    |       +--> cas_math.registry
    |       +--> units.definitions / convert
    |
    +--> SymPy / CAS-funktion
    v
output.result.wrap_result()
    |  JSON-streng
    v
JSON-resultat
    |
    v
Document Runtime
    |  result / dirty state
    v
Renderer / UI
```

## 2. De centrale lag

### 2.1 Parserlaget
`docs/Grammatik.pegjs` er kilden; `src/js/parser.mjs` er genereret af Peggy.

Parserens ansvar er syntaks og AST. Den ved **ikke**, hvilke CAS-funktioner der findes.

Den aktuelle grammatik har en generisk regel:

```pegjs
FunctionCall
  = id:Identifier "(" _ args:Args _ ")"
```

Derfor parses både `sin(x)` og `binompdf(2; 10; 0,5)` som samme nodetype: `FunctionCall`.

### 2.2 Transformerlaget
Transformerlaget tager AST og producerer Python-kode. Den aktuelle JS-kode er ikke med i snapshot'et, men E2E-testen bruger `new Transformer(...)` og `toPython(ast)`.

### 2.3 Document Runtime
`src/js/document-runtime.js` ejer dokumentets beregningsmæssige semantik. UI'et må ikke selv reparere dependency-grafer, task scopes eller dirty state.

Document Runtime holder `blocks[]` som den autoritative dokumentorden. For formelblokke er `source` autoritativ brugerdata; AST, dependencies og beregningsstate er afledte eller runtime-specifikke data. AST skal derfor ikke persisteres som dokumentets sandhed.

En FormulaBlock er i v1 én atomisk instruktion. Reads fortolkes mod task-state umiddelbart før blokken, og writes bliver tilgængelige for efterfølgende blokke. Multi-statement blokke er et senere designspørgsmål.

### 2.4 Runtimelaget
`core/context.py`, `core/executor.py` og `core/scope.py` udgør runtime-kernen.

`run_in_task(task_id, code)` er det centrale Python-interface:

```python
run_in_task(task_id: str, code: str) -> str
```

Samme `task_id` giver persistens mellem kald; forskellige `task_id` har adskilte scopes.

### 2.5 Matematiklaget
`cas_math/` er opdelt i `calculus.py`, `statistics.py`, `distributions.py` og `registry.py`.

`registry.py` er det autoritative registreringspunkt for offentlige CAS-funktioner.

### 2.6 Output- og enhedslaget
`output/result.py` omsætter Python/SymPy-resultater til JSON. `output/errors.py` standardiserer fejl. `units/` håndterer enheder og konvertering.

## 3. Autoritetsreglen for nye funktioner

Den enkleste og mest robuste model er:

```text
ny funktion
   -> implementér i cas_math/*.py
   -> registrér i cas_math/registry.py
   -> tilføj isoleret test
   -> tilføj E2E-test
   -> dokumentér i funktionskataloget
```

**Ingen ændring i grammatikken er normalt nødvendig.**

## 4. Scope

`BASE_CONTEXT` bygges én gang ved import. `task_registry` indeholder lokale namespaces.

`ScopedGlobals` sørger for, at en funktion defineret i et task-scope stadig kan slå task-lokale variable op ved senere kald.

Ukendte navne kan automatisk blive til SymPy-symboler, medmindre navnet er beskyttet.


## 5. Dokumentorden, dependencies og strukturelle mutationer

Dokumentorden har matematisk betydning. For hver task bygges en separat dependency-analyse ud fra de formelblokke, der tilhører tasken. Der oprettes ingen dependency-edges mellem tasks.

Et symbol-read bindes til den **nærmeste foregående formelblok i samme task**, som skriver symbolet. Analysen producerer både en dependency-DAG og interne `symbol -> provider block` bindings. Bindings er nødvendige, fordi en strukturel ændring kan skifte provider uden nødvendigvis at ændre grafens edge-mængde.

Dependency analysis er afledt af `blocks[]` og rebuildes fuldt efter strukturelle mutationer. Den nuværende model foretrækker dermed enkel og verificerbar korrekthed frem for incremental graph surgery.

Document Runtime understøtter strukturelt:

- `insertBlock(block, index)`
- `moveBlock(blockId, index)`
- `removeBlock(blockId)`

Ved en strukturel ændring sammenlignes gamle og nye bindings. Eksisterende blokke med ændret binding markeres dirty sammen med deres transitive downstream i den **nye** dependency-graf. Nye blokke starter `idle`; fjernede blokke indgår ikke i invalidation-resultatet.

Source-mutation og structural mutation har forskellige invalidationsregler. `setBlockSource()` håndterer ændring af en eksisterende bloks source, mens de strukturelle operationer håndterer ændret dokumentorden og provider-binding.

Detaljerne og begrundelsen er fastholdt i `ADR-0006-document-order-dependencies-and-structural-mutations.md`.

## 6. Aktuelt registry

Der registreres 35 funktioner i det leverede snapshot:

- Calculus: `diff`, `integrate`, `limit`, `arclength`
- Statistik: `mean`, `median`, `Q1`, `Q3`, `min`, `max`
- Regression: `linReg`, `expReg`, `powReg`, `logReg`
- Binomial/test: `binompdf`, `binomcdf`, `mean_B`, `var_B`, `std_B`, `binomtest`, `chi2gof`, `chi2ind`, `ttest1`, `ttest2`
- Poisson: `poissonpdf`, `poissoncdf`, `mean_Po`, `var_Po`, `std_Po`
- Normal: `normpdf`, `normcdf`, `invnorm`, `mean_N`, `var_N`, `std_N`

## 7. Outputkontrakt

`type` er den centrale discriminator for alle resultater.

### Scalar

```json
{"type":"scalar","latex":"0{,}0439453","decimal":"0.0439453125"}
```

`decimal` er historisk navngivet, men betyder en **displaystreng med numerisk eller tekstlig approksimation**. Den er derfor ikke garanteret at kunne parses med `parseFloat()`.

For symbolske resultater kan der desuden være:

```json
{"type":"scalar","latex":"x^2+1","decimal":"x**2 + 1","is_symbolic":true}
```

### Strukturerede resultater

`hypothesis_test` og `regression` har egne strukturerede kontrakter og skal ikke behandles som scalars.

`regression` bruger aktuelt `params` til koefficienterne.

Den komplette og autoritative beskrivelse findes i `JSON_KONTRAKTER.md`.

## 8. Enheder

Enheder findes i `units/definitions.py`. Selve konverteringen findes i `units/convert.py`.

Eksempel:

```text
36[km/h] -> [m/s]
```

## 9. Hvad dokumentationen tidligere tog fejl af

- Den beskrev `setup.py` som Python-kernens hovedmodul. Koden er nu refaktoreret til `core/`, `cas_math/`, `output/` og `units/`.
- Den gamle beskrivelse af `FunctionDefinition` som `Lambda` er forældet; runtime arbejder med funktiondefinitioner/scoped globals.
- Den gamle fejlkatalog-beskrivelse er mere detaljeret end den aktuelle `errors.py` og skal ikke bruges som aktuel kontrakt.
- Fordelingsfunktioner er allerede implementeret og registreret.