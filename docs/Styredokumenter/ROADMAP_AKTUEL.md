# newCAS - Aktuel roadmap-status for leveret snapshot

**Grundlag:** det leverede Repomix-kodeudtræk. Ikke en påstand om repositoryets tilstand efter snapshot-datoen.

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
- komplet JS-frontend er med i det aktuelle snapshot: `cas-engine.js`, `transformer.js`, `renderer.js`, `settings.js`, `main.js` og `python-files.js`

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

## Ikke verificeret / ikke med i det aktuelle snapshot

- komplet JS-frontend
- Plotly-visualisering
- Web Worker
- `.ncas` filhåndtering
- profilfil
- Service Worker

## Næste tekniske prioritet

1. Brug de nye kontrakttests som fast værn mod drift.
2. Hold Transformer/CASEngine/renderer/settings dokumenteret direkte mod den komplette JS-kode.
3. Først derefter fortsættes med større features som Worker/Plotly.
