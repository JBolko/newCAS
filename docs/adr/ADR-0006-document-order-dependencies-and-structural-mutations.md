# ADR-0006 -- Document Order, Dependency Bindings og Structural Mutations

**Status:** Accepted  
**Dato:** 2026-09

## Beslutning

newCAS skal behandle dokumentets blokorden som en del af den matematiske semantik.

For hver task bygges en separat dependency-analyse ud fra dokumentets ordnede formelblokke. Et symbol-read bindes til den **nærmeste foregående formelblok i samme task**, som skriver symbolet.

Dependency-analysen producerer både:

- en dependency-DAG mellem formelblokke, og
- interne `symbol -> provider block` bindings.

Ved strukturelle ændringer rebuildes analysen fuldt ud fra den autoritative blokorden. Eksisterende blokke, hvis bindings ændres, markeres dirty sammen med deres transitive downstream i den nye graf.

## Motivation

I et dokumentorienteret CAS har rækkefølgen af definitioner betydning.

```text
a := 2
b := a + 1
a := 3*b
```

Den midterste blok læser den første definition af `a`. Den sidste blok opretter en ny definition, som kun gælder for efterfølgende blokke.

Modellen kan forstås SSA-lignende:

```text
a₁ := 2
b  := a₁ + 1
a₂ := 3*b
```

newCAS implementerer ikke bogstavelig SSA, men analogien gør provider-semantikken tydelig.

## Autoritativ dokumentorden

`DocumentRuntime.blocks[]` er den autoritative rækkefølge.

Dependency graph, provider-bindings, AST og beregningsstate er afledte eller runtime-specifikke strukturer. De må ikke overtage rollen som dokumentets primære sandhed.

Når dokumentorden eller en bloks dependencies ændres, kan analysen derfor altid rekonstrueres fra blokmodellen.

## FormulaBlock v1

En FormulaBlock er i v1 én atomisk beregningsinstruktion.

Reads fortolkes mod task-state umiddelbart før blokken. Writes fra blokken bliver tilgængelige for efterfølgende blokke.

Det betyder blandt andet, at et read og et write af samme symbol i én blok ikke skaber en selv-edge: read'et binder til en tidligere provider, hvorefter blokken bliver ny writer.

Multi-statement blokke med intern sekventiel semantik er et senere designområde og ændrer ikke denne v1-kontrakt.

## Task-isolation

Hver task analyseres uafhængigt.

Der oprettes ingen dependency-edges eller provider-bindings på tværs af tasks. Dette svarer til runtime-princippet om adskilte task scopes.

## Hvorfor graph alene ikke er nok

En strukturel ændring kan ændre matematisk betydning uden at ændre den synlige edge-mængde.

Eksempel:

```text
A skriver {a, b}
B skriver {b, c}
X læser  {a, b, c}
```

Hvis A og B bytter plads, kan X fortsat have edges fra både A og B. Men provider for `b` ændres.

Derfor skal dependency analysis også bevare den konkrete binding mellem hvert resolved read og den blok, der leverer symbolet.

## Samlet dependency analysis

Én ordnet traversal af dokumentets formelblokke producerer per task:

```text
{
    graph: DependencyGraph,
    bindings: Map
}
```

Traversalens writer-table opdateres først efter behandling af blokkens reads. Dermed følger analysen FormulaBlock-v1-semantikken.

Unresolved reads har ingen document-provider-binding. De kan fortsat få betydning gennem runtime, eksempelvis som auto-symboler.

## Full rebuild frem for incremental graph surgery

Ved strukturelle mutationer rebuildes dependency analysis fra `blocks[]`.

Dette er et bevidst valg. Dokumenter forventes at have en størrelse, hvor et fuldt analysepass er billigt, mens modellen bliver væsentligt enklere at verificere end en løsning, der forsøger at reparere edges og bindings inkrementelt.

Hvis performance senere bliver et dokumenteret problem, kan implementationen optimeres uden at ændre den semantiske kontrakt i dette ADR.

## Structural invalidation

Efter en strukturel mutation sammenlignes gammel og ny analyse.

En eksisterende blok er direkte påvirket, hvis dens provider-binding ændres, herunder hvis:

- en provider skifter til en anden blok,
- en tidligere provider forsvinder,
- et tidligere unresolved read får en document-provider.

Derefter tilføjes blokkens transitive downstream i den **nye** dependency-graf.

De berørte blokke markeres dirty efter de almindelige dirty-state-regler.

For structural mutations er downstream fra den gamle graf ikke nødvendig som generel regel: en eksisterende consumer, der mister eller skifter en gammel relation, har selv en ændret binding og bliver derfor direkte ramt.

## Strukturelle operationer

Document Runtime ejer operationerne:

```text
insertBlock(block, index)
moveBlock(blockId, index)
removeBlock(blockId)
```

Index for insertion og move beskriver den ønskede slutposition.

Nye blokke starter `idle`. Fjernede blokke indgår ikke i invalidation-resultatet.

UI'et skal kalde disse operationer og må ikke selv flytte blokke og bagefter forsøge at reparere dependency graph eller dirty state.

## Atomaritet ved afviste mutationer

Validering og parsing skal ske før dokumentmutation, når operationen kan afvises på forhånd.

Et ugyldigt index, duplicate block-id eller ugyldig formelsource må derfor ikke efterlade dokumentet delvist ændret eller udløse et unødvendigt rebuild af dependency analysis.

## Reaktiv genberegning

Dependency graph bestemmer **hvilke** blokke der påvirkes. Dokumentorden bestemmer **i hvilken rækkefølge** dirty formelblokke genberegnes.

Fejl i én gren må blokere dens afhængige downstream, men skal ikke forhindre genberegning af uafhængige grene.

Generation guards beskytter desuden mod, at et gammelt asynkront resultat overskriver en nyere dokumenttilstand.

## Alternativer, der blev fravalgt

### Kun dependency graph

Fravalgt, fordi samme edge-mængde kan skjule ændrede symbol-provider-bindings.

### Global genberegning efter enhver ændring

Fravalgt, fordi den er unødvendigt dyr og gør den reaktive model mindre præcis.

### Incremental graph surgery fra starten

Fravalgt, fordi den øger kompleksiteten og risikoen for skjulte konsistensfejl uden et dokumenteret performancebehov.

### UI-ejet dependency-logik

Fravalgt, fordi dokumentets beregningssemantik skal være uafhængig af konkrete UI-komponenter og kunne testes isoleret.

## Konsekvenser

Fordelene er:

- deterministisk og testbar dokumentsemantik,
- klar task-isolation,
- korrekt håndtering af redefinitioner,
- robuste insert/move/remove-operationer,
- målrettet dirty invalidation,
- mulighed for senere developer-værktøjer som "Find definition" og dependency-visning.

Prisen er, at strukturelle mutationer udfører et fuldt dependency-analysis-pass. Det accepteres bevidst i v1.

## Forholdet til ADR-0004 og ADR-0005

ADR-0004 fastlægger Document Runtime og den reaktive dokumentmodel.

Dette ADR fastlægger den konkrete beregningssemantik for dokumentorden, dependency bindings og strukturelle mutationer.

ADR-0005 fastlægger persistence-, freeze- og submission-grænsen. En submitted snapshot er frossen og skal derfor ikke fortsætte den reaktive mutationssemantik beskrevet her.

## Designprincip

> Dokumentorden er matematisk semantik. Dependency analysis er afledt af dokumentet, ikke omvendt.

Document Runtime ejer denne relation. UI'et må bruge den, men ikke genimplementere den.
