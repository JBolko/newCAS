# ADR-0005 -- Document Persistence og Submission

**Status:** Accepted\
**Dato:** 2026-09

## Beslutning

newCAS skal skelne tydeligt mellem et **reaktivt dokument under
redigering** og en **frossen aflevering**.

Under redigering kan beregninger, variable og dokumentblokke opdateres
reaktivt. Når en aflevering fastfryses, skal den repræsentere den
autoritative tilstand på afleveringstidspunktet.

PDF'en er den endelige, menneskeligt læsbare afleveringsrepræsentation.
Et internt snapshot kan desuden bevare den strukturerede newCAS-tilstand
til arkivering og reproducerbarhed.

## Motivation

Et reaktivt dokument er nyttigt under arbejdet, men en aflevering skal
ikke ændre sig efter afleveringsøjeblikket.

Hvis en elev senere åbner dokumentet med en nyere version af newCAS, en
nyere SymPy-version eller ændrede beregningsregler, må det ikke ændre
den historiske aflevering.

Derfor skal redigering og aflevering have forskellige livscyklusser.

## Dokumenttilstande

newCAS skal som minimum skelne mellem:

``` text
Editable
   ↓
Submitted Snapshot
   ↓
PDF
```

### Editable

Det normale arbejdsdokument.

-   Beregninger er aktive.
-   Variable kan ændres.
-   Dependencies er aktive.
-   Berørte blokke kan genberegnes og re-renderes.

### Submitted Snapshot

En frossen struktureret repræsentation af dokumentets tilstand på
afleveringstidspunktet.

Snapshot'et må ikke automatisk genberegnes, når det åbnes som historisk
aflevering.

### PDF

Den endelige visuelle aflevering.

PDF'en skal kunne læses og bedømmes uden adgang til newCAS.

## Snapshot-indhold

Et submitted snapshot bør kunne indeholde mindst:

``` json
{
  "document_version": 1,
  "engine_version": "0.1.0",
  "submitted_at": "2026-09-20T10:00:00+02:00",
  "variables": [],
  "blocks": [],
  "metadata": {}
}
```

Den endelige kontrakt fastlægges senere, men snapshot'et bør principielt
bevare:

-   dokumentformatets version,
-   newCAS/engine-version,
-   variabeltabellen med nødvendige værdier,
-   dokumentblokke,
-   de renderede eller renderbare repræsentationer,
-   relevante metadata.

Yderligere versionsinformation, eksempelvis SymPy/Pyodide-version, kan
tilføjes, hvis det bliver nødvendigt for reproducerbarhed.

## Variable i snapshot

Variable skal gemmes med tilstrækkelig information til at bevare den
afleverede matematiske tilstand.

Afrunding i dokumentets visning må ikke reducere den gemte værdis
præcision.

Dette følger variabelmodellen i ADR-0004.

## Renderede blokke

Et snapshot skal kunne bevare den tilstand, eleven faktisk afleverede.

Det betyder, at en historisk visning ikke bør være afhængig af, at alle
beregninger køres igen med den aktuelle runtime.

For relevante blokke kan snapshot'et derfor indeholde både strukturel
information og den afleverede visningsrepræsentation.

## PDF-generation

PDF'en skal genereres ud fra den frosne afleveringsstate -- ikke fra en
senere genberegnet version af dokumentet.

Princippet er:

``` text
reaktivt dokument
      ↓
freeze
      ↓
submitted snapshot
      ↓
render
      ↓
PDF
```

Dermed svarer PDF'en til den state, der blev afleveret.

## Genåbning af en aflevering

En submitted aflevering skal som udgangspunkt åbnes som arkiv/historisk
dokument uden automatisk genberegning.

Hvis eleven ønsker at arbejde videre, bør newCAS oprette en **redigerbar
kopi**.

``` text
Submitted Snapshot
       ├──> Åbn som arkiv
       └──> Opret redigerbar kopi
```

Den historiske aflevering ændres dermed ikke.

## Reaktivitet versus reproducerbarhed

De to krav er ikke modsætninger.

Under redigering ønsker vi:

-   automatiske opdateringer,
-   dependency tracking,
-   genberegning.

Efter aflevering ønsker vi:

-   stabil tilstand,
-   historisk sporbarhed,
-   uændret visning.

Derfor er freeze-grænsen en eksplicit del af arkitekturen.

## Forholdet til skolens aflevering

I den forventede gymnasiebrug er **PDF'en den faktiske aflevering til
lærer/censor**.

Det interne submitted snapshot er ikke en erstatning for PDF'en. Det er
newCAS' egen mekanisme til at bevare dokumentets strukturerede tilstand
og eventuelt understøtte senere arkivering, fejlsøgning og
reproducerbarhed.

Censor eller lærer skal ikke være afhængig af newCAS for at læse
afleveringen.

## Forholdet til ADR-0004

ADR-0004 beskriver Document Runtime og den reaktive dokumentmodel.

ADR-0005 beskriver, hvad der sker ved persistens og aflevering.

Kort sagt:

``` text
ADR-0004:
Hvordan lever dokumentet under redigering?

ADR-0005:
Hvordan bevarer vi dokumentets tilstand ved aflevering?
```

## Designprincip

> Et arbejdsdokument må gerne være levende. En aflevering skal være
> frossen.

PDF'en fastholder den endelige visuelle aflevering, mens et struktureret
snapshot kan fastholde den interne newCAS-tilstand.
