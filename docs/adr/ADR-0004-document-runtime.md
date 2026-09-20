# ADR-0004 -- Document Runtime og reaktive dokumenter

**Status:** Accepted\
**Dato:** 2026-09\
**Revision:** 1

## Beslutning

newCAS skal betragte det matematiske dokument som den primære model.
CAS-motoren er beregningsmotoren, mens dokumentet består af reaktive
blokke -- tekst, formler, tabeller, grafer og kode -- som kan opdateres,
når de variable, de afhænger af, ændres.

UI'et må aldrig læse SymPy-objekter eller Python-scope direkte.
Kommunikation mellem runtime, Document Runtime og UI skal ske gennem
stabile JSON-kontrakter.

## Motivation

Gymnasieelever skriver ikke kun beregninger. De skriver rapporter,
SRO'er, laboratoriejournaler, forklaringer og konklusioner.

Et dokument kan eksempelvis indeholde teksten:

> Den beregnede kastelængde er 42,3 m.

Hvis variablen `s` ændres, skal værdien i teksten kunne opdateres
automatisk uden manuel rettelse.

Målet er at kombinere dokumentorienteret arbejde med CAS'ens symbolske
beregninger og regnearks-lignende reaktivitet, uden at UI'et bliver
afhængigt af Python- eller SymPy-internals.

## Arkitektur

``` text
Editor/UI
    ↓
Document Runtime
    ↓
Executor
    ↓
Task Scope
```

### Ansvarsfordeling

  -----------------------------------------------------------------------
  Lag                                 Ansvar
  ----------------------------------- -----------------------------------
  UI                                  Visning, redigering og
                                      brugerinteraktion

  Document Runtime                    Dokumentmodel, dependencies,
                                      visningsregler og dirty updates

  Executor                            Beregning og evaluering

  Task Scope                          Runtime-tilstand og variable
  -----------------------------------------------------------------------

Denne lagdeling skal bevares. UI'et ejer ikke beregningsdata.

## Variabelmodel

En variabel skal kunne repræsenteres med fuld intern præcision og
samtidig have en separat visningsrepræsentation.

Eksempel med `1/3`:

  Lag                  Repræsentation
  -------------------- -----------------
  Intern værdi         `Rational(1,3)`
  Persistérbar værdi   `"1/3"`
  Visning              `0,333`

For numeriske værdier gælder samme princip: lagring må ikke reducere
præcisionen blot fordi dokumentet viser færre decimaler.

**Princip:** Afrunding er en visningsregel, ikke en ændring af den
matematiske værdi.

## JSON-kontrakt for variable

En mulig kontrakt er:

``` json
{
  "name": "s",
  "expr": "v0*t + 1/2*a*t^2",
  "value": "42.318471",
  "exact": false,
  "precision": 15,
  "unit": "m",
  "source_block": "eq17",
  "display": {
    "latex": "42.318471",
    "text": "42.318471"
  }
}
```

Felterne har følgende roller:

-   `name` er variablens navn.
-   `expr` er den oprindelige definition eller det beregnede udtryk.
-   `value` bevarer værdien med den nødvendige præcision.
-   `exact` angiver, om værdien er eksakt.
-   `precision` beskriver numerisk præcision, når det er relevant.
-   `unit` kan indeholde en enhed.
-   `source_block` peger på den blok, der definerer variablen.
-   `display.latex` er en egentlig LaTeX-repræsentation.
-   `display.text` er en tekstlig standardrepræsentation.

`source_block` gør senere funktioner som "Find definition" mulige.

## Tekst som segmenter

Eleven skal ikke skrive en templatesyntaks som `{{s:1}}`. UI'et kan i
stedet tilbyde en **Var**-funktion, som indsætter en variabelreference i
dokumentmodellen.

Eksempel:

``` json
{
  "id": "txt17",
  "type": "text",
  "style": "paragraph",
  "segments": [
    {
      "type": "text",
      "value": "Den beregnede kastelængde er ",
      "marks": []
    },
    {
      "type": "variable",
      "name": "s",
      "show": "value",
      "decimals": 1,
      "marks": ["bold"]
    },
    {
      "type": "text",
      "value": " m.",
      "marks": []
    }
  ]
}
```

Tekst og variable er dermed separate segmenter, men vises som ét
sammenhængende afsnit.

## Formatering

Formatering opdeles i to niveauer.

### Block style

`style` beskriver hele blokkens rolle, eksempelvis:

-   `paragraph`
-   `heading`
-   `quote`
-   listevarianter

### Segment marks

`marks` beskriver lokal formatering af et segment, eksempelvis:

-   `bold`
-   `italic`
-   `underline`
-   `strike`
-   `subscript`
-   `superscript`

Dermed blandes dokumentstruktur ikke sammen med lokal tekstformatering.

## Visning af variable

Et variablesegment kan blandt andet have:

``` json
{
  "type": "variable",
  "name": "s",
  "show": "name_value",
  "decimals": 2
}
```

`show` kan i første omgang understøtte:

-   `value` -- kun værdien vises.
-   `name_value` -- navn og værdi vises.

### Autoritet for visningsregler

Når flere visningsregler findes, gælder følgende prioritet:

``` text
segmentets visningsregel
        ↓
variablens standardvisning
        ↓
runtime-standard
```

Et lokalt ønske om én decimal ændrer derfor ikke variablens værdi eller
standardvisning andre steder i dokumentet.

## Dependencies

newCAS skal skelne mellem to dependency-grafer.

### Beregningsdependencies

Runtime håndterer matematiske afhængigheder mellem variable og
beregninger.

Eksempel:

``` text
a ─┐
   ├─> s
t ─┘
```

### Præsentationsdependencies

Document Runtime håndterer, hvilke dokumentblokke der viser eller
anvender bestemte variable.

Eksempel:

``` text
s ──> tekstblok 17
s ──> tabel 3
s ──> graf 2
```

De to grafer har forskellige ansvarsområder og bør ikke blandes sammen.

## Dirty updates

Når en variabel ændres, skal newCAS så vidt muligt kun opdatere de
noder, der afhænger af ændringen.

``` text
ændret variabel
      ↓
beregningsdependencies
      ↓
ændrede resultater
      ↓
præsentationsdependencies
      ↓
berørte blokke markeres dirty
      ↓
målrettet re-render/recalculation
```

Hele dokumentet bør ikke genberegnes eller renderes unødvendigt.

## Bloktyper

Den reaktive dokumentmodel skal kunne udvides til flere bloktyper.

Første naturlige typer er:

-   `text`
-   `formula`
-   `table`
-   `graph`
-   `code`

Billeder kan være dokumentblokke uden nødvendigvis at være reaktive.

## Fremtidige værktøjer

Arkitekturen gør senere funktioner mulige, eksempelvis:

-   Find definition.
-   Vis afhængigheder.
-   Vis hvor en variabel anvendes.
-   Genberegn kun påvirkede blokke.
-   Developer-visning af dependency-grafer.
-   Dokumentdiagnostik for brudte variabelreferencer.

Disse funktioner skal bygges oven på Document Runtime-kontrakten og ikke
ved at give UI'et direkte adgang til Python-scope.

## Persistence og aflevering

Dette ADR beskriver den reaktive dokumentmodel under redigering.

Persistens, frosne afleveringer, snapshots og PDF-generation behandles
særskilt i **ADR-0005 -- Document Persistence og Submission**.

## Designprincip

> Beregningen ejer den matematiske sandhed. Document Runtime ejer
> relationen mellem beregning og dokument. UI'et ejer kun interaktionen
> og præsentationen.

Denne opdeling skal gøre newCAS' dokumentformat stabilt, testbart og
uafhængigt af konkrete UI-komponenter.
