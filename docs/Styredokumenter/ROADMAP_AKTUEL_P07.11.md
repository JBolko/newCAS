# newCAS - Aktuel roadmap-status

**Status:** 23. september 2026. Opdateret gennem P07.11 Structural Mutations.

## Fase 1 - Core engine: dokumenteret som implementeret

- Parser med dansk notation
- AST -> Python-transformationskæde (refereret af E2E)
- Task-scope og persistens
- Auto-symboler
- Calculus
- Statistik
- Regression
- Enheder
- JSON-resultater
- Strukturerede fejl

## Fase 1B - Arkitektur-konsolidering: observeret i kode

- `cas_math` er opdelt i domænemoduler og registry
- `core`, `output` og `units` er separate lag
- bootstrap er tynd
- E2E-testen bruger `CASEngine`
- JS-laget omfatter bl.a. `cas-engine.js`, `transformer.js`, `renderer.js`, `settings.js`, `main.js` og Document Runtime-laget

## Sandsynlighedsfordelinger: Python-lag implementeret

Registreret i `registry.py` og implementeret i `distributions.py`:

- Binomial: `binompdf`, `binomcdf`, `mean_B`, `var_B`, `std_B`
- Poisson: `poissonpdf`, `poissoncdf`, `mean_Po`, `var_Po`, `std_Po`
- Normal: `normpdf`, `normcdf`, `invnorm`, `mean_N`, `var_N`, `std_N`

De kræver ikke ekstra grammatikregler, fordi parseren har et generisk `FunctionCall`.

## Hypotesetest: Python-lag observeret som implementeret

- `binomtest`
- `chi2gof`
- `chi2ind`
- `ttest1`
- `ttest2`

`wrap_result` videresender `type: hypothesis_test`.

## Pass 7 - Document Runtime

### P07.1-P07.7 - Fundament: implementeret

- stabil task-state JSON-kontrakt fra Python
- CASEngine-bridge til task state
- DocumentRuntime med dokument-id-baseret task-isolation
- Document Model v1 med tekst- og formelblokke
- beregningsstate for formelblokke
- AST dependency analyzer
- `source` er autoritativt indhold; AST og dependencies er afledte data

### P07.8 - Dependency graph: implementeret

- separat dependency-DAG per task
- nearest-preceding-writer-semantik
- samlet dependency analysis med både graph og `symbol -> provider` bindings
- transitive upstream/downstream-operationer

### P07.9 - Dirty state og stale-result protection: implementeret

- `idle`, `running`, `success`, `error` og `dirty`
- generation guard beskytter mod gamle async-resultater
- dirty state kan bevare et tidligere resultat som stale visning

### P07.10 - Reactive recalculation: implementeret

- målrettet genberegning af dirty blokke
- dokumentorden bestemmer eksekveringsrækkefølgen
- fejl stopper afhængige downstream-blokke, men ikke uafhængige grene

### P07.11 - Structural Mutations: implementeret

- `insertBlock()`
- `moveBlock()`
- `removeBlock()`
- fuldt rebuild af dependency analysis efter strukturelle ændringer
- invalidation baseret på ændrede provider-bindings plus downstream i den nye graf
- validering/parsing sker før mutation, så afviste operationer ikke ændrer dokument eller dependency analysis
- FormulaBlock v1 er én atomisk instruktion

P07.11 er dækket af den aktuelle JS-testsuite, som ved afslutningen af delarbejdet står på 110 beståede tests.

## Ikke verificeret / senere arbejde

- Plotly-visualisering
- Web Worker
- `.ncas` filhåndtering
- profilfil
- Service Worker

## Næste tekniske prioritet

1. P07.12: runtime inspection / serialization boundary uden læk af AST, Maps eller andre transient internals.
2. P07.13: Pass-7 integration, dokumentationssynkronisering og fuld baseline.
3. Derefter lukkes Pass 7 eksplicit før næste større featureområde åbnes.
