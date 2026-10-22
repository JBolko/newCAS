# newCAS S99 — disposition af Claudes kritiske review

**Status:** Udkast til beslutningslog (22. oktober 2026), **ikke** normativ ADR eller implementeringsordre.
**Grundlag:** `S99 — kritisk arkitektur- og matematikreview.md` (Claude, 22. oktober 2026) og efterfølgende S99-samtale.
**Tilhørende dokument:** `S99_KONTRAKTUDKAST.md` r2.
**Formål:** Gøre det efterprøveligt, hvad der er rettet, hvad der er et åbent kontraktvalg, og hvor vi **bevidst** ikke har fulgt Claudes foreslåede løsning. Reviewet er ikke gengivet her; se originalen for begrundelser og kildehenvisninger.

## Beslutning om reviewets hovedkonklusion

- Ingen påvist nødvendighed af at ændre FROZEN v1.0 her og nu. Gældende FROZEN/accepted ADR outranker S99.
- B1–B5 er **reelle problemstillinger** og er rettet/afgrænset i r2; r2 alene løser **ikke** alle de senere versionerede kontrakter.
- B6 (implicit monotonilinje-scope-søgning) er **udtaget som bindende krav**. Monotonilinje er et muligt, fremtidigt pædagogisk UI-værktøj; om det kan realiseres, skal undersøges senere.
- **Fire rige Value-familier fastholdes som ønsket designretning.** Særligt `StatisticsValue` og `TestResultValue` opgives **ikke** på Claudes anbefaling. Et Value er én sammenhængende matematisk værdi, ikke nødvendigvis ét numerisk tal. Det nødvendige P0005-tillæg og konkrete implementeringsprioriteter kommer separat.
- Versioneret konkret kontrakt før **berørt** slice; ikke krav om alle ADR'er færdige før arbejde med uafhængige matematikfunktioner. Ingen kode eller releaseclaim i denne dokumentationspakke.

## Reviewfund → r2-tiltag

| Review | Disposition i S99 r2 | Videre gate |
| --- | --- | --- |
| **B1** alias/i18n | **Enig:** parse-relevante aliaser i `languageVersion` eller kanonisk kilde; `dk-3` kun visning/forslag. §11 | Persistens-/kildesyntaks-ADR; P0018 |
| **B2** enum/options | **Enig i mangel:** generisk elev-API bibeholdes som mål, men ikke som v1-kontrakt. Separate `linreg/expreg/...` er mulig v1-vej. §6, §8 | P0008/OperationSpec før sådanne kald |
| **B3** binomial-default | **Enig:** oprettelsesbunden autoritativ dokumentkonvention; direkte korte acceptfunktioner gælder denne default. §8, §11 | Persistens-ADR, retning/metode-API |
| **B4** fitkriterium | **Enig:** matematikken kræver metodevalg, også for `R²`; log-lineært fit er *forslag*, ikke aftale. §6 | Beslutning før exp-/potens-regressionsslice |
| **B5** naturligt domæne | **Enig:** punktvis minimum; ingen garanti for fuld symbolsk løsning af naturlig definitionsmængde; real/kompleks og `f(a)` åbne. §9 | Domæne-ADR + P0005-version |
| **B6** monotonilinje | **Revideret ambition:** ikke kontrakt; **følger ikke** Claudes konkrete `monotonilinje(f,df,N)`-krav nu. §2, §13 | Fremtidig UI-/didaktisk feasibility |
| **D1** Value-kinds | **Delvis enig:** versioneret P0005 og transport nødvendige; **uenig** i at slette `StatisticsValue`/`TestResultValue` fra design. §3 | P0005-version, evt. trinvis implementering |
| **D2** collections | **Foreløbigt enig:** kvartiler som ordnet `ListValue`, mode som endelig `SetValue`, kritiske områder over heltal. §3 | P0005 felt-/returtypekontrakt |
| **D3** `~`-definition | **Enig i retning:** binder `X` som skriver/fordelings-Value, men ækvivalens med `:=` og identitet er ikke normativt besluttet. §7 | PEG/IR-kontrakt |
| **D4** navnekollision | **Enig i problem:** kontekstuel `b`/`n` er kandidat, `P`-forrang uafklaret. §7 | Parser/binding review |
| **D5** kædede relationer | **Enig i krav:** én semantisk repræsentation for hændelser/domæner, ikke tre særveje. §7, §13 | P0005/P0018 |
| **D6** domænesyntaks | **Enig:** `, 0<=x<8` er illustrativ; `|` er allerede substitution, `,` er konfliktramt. §9 | P0018 |
| **D7** konventionsprofil | **Enig i mål:** oprettelsesbunden dokumentoption, `options` transport, legacy-profil, transaction/invalidation; opgave vs. dokument åbent. §11 | Persistens-ADR |
| **D8** eksakte literaler | **Enig i gate:** kanonisk kilde eller versioneret dialekt; `parseFloat` i kanonisk AST er utilstrækkeligt til eksakte tests. §11 | P0018/F8 |
| **D9** hyppigheder | **Præciseret:** absolutte ikke-negative hele hyppigheder; resten eksplicitte operationstest. §5 | Statistik-slice |
| **D10** kritisk mængde | **Enig:** p<=α under én metode, komplement i `{0,...,n}`. §8 | Binomialtest-slice, exactness |
| **D11** plotanalyse | **Enig:** matematisk analyse i evaluator, ikke renderer; ingen hemmelig autoritet. §10 | Senere ADR-0004/plot-slice |
| **D12** domæneversion | **Enig:** ny semantik/felt kræver ADR/P0005-version. §9 | Domæne-ADR |
| **D13** fordelingsdetaljer | **Præciseret/åbent:** mindste x med F(x)>=q som forslag; tabelvalidering; argumentorden skal fryses. §7 | Fordelings-slice |

## Verificerede matematiske tests i den forberedende gennemgang

Med **eksakt brøkaritmetik** for `X ~ Bin(50,1/4)` og `α=1/20` er acceptmængden (to-sidet) ved metoden med fordobling af mindste hale `{7,...,19}`, og ved sandsynlighedsordning `{7,...,18}`. For `k=19` er p-værdierne ca. `0.057466319671` og `0.048124031996`. Disse størrelser er **referenceforventninger til fremtidige tests**, ikke kørte newCAS-tests. For `Bin(9,1/2)` er modalværdierne `{4,5}`.

## Hvad denne pakke **ikke** gør

- Ingen ændringer af FROZEN, accepterede ADR'er, P0005/P0008/P0010, programkode eller testfiler.
- Ingen godkendelse af nyt `.ncas`-schema, ny parsergrammatik, regressionsfit-kriterium eller domæne-ADR.
- Ingen retouchering af S98e/N6/TODO/SKIP-status, roadmap-exit eller releaseaccept.
- Ingen commit/staging udført i brugerens Git-repositorium. De to MD-filer leveres repo-relativt til lokal diff-/stage-inspektion.

## Foreslået commit-intention

**`docs(s99): revise math-beta contract after architecture review`**

Kun de to Markdown-filer i `docs/Styredokumenter/`. Hvis et tidligere S99-udkast allerede er commit'et, skal r2 behandles som revision af den fil; ellers som ny informativ dokumentation. Efter eventuelt commit skal handover/roadmap kun opdateres ved en særskilt, kontrolleret dokumentationsændring, hvis de skal angive ny status.
