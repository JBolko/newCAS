# Brugergrænseflade og interaktionsdesign — newCAS
*Rev. 120426*

---

## 1. UI-filosofi

Brugergrænsefladen følger **notebook-paradigmet**: arbejdet foregår i et lineært dokument fra top til bund, præcis som en skriftlig besvarelse på papir. Dette er et bevidst pædagogisk valg — det afspejler den struktur eleverne allerede kender, og det gør dokumentation til en naturlig del af arbejdsprocessen frem for en eftertanke.

Tre principper styrer alle UI-beslutninger:

**Matematik-først.** Input-felter er altid klar til matematik. Eleven behøver ikke skifte mode, klikke en knap eller vælge en funktion fra en menu for at beregne. De skriver og trykker Enter.

**Ingen overraskelser.** Systemet gør præcis hvad elevens input siger. Scope-isolation sikrer at variable i én opgave ikke forurener en anden. Fejlbeskeder er på dansk og forklarende — ikke Python-tracebacks.

**Rentegnet output.** Resultater renderes med professionel matematisk typografi (KaTeX). Decimaler vises med komma (dansk standard). Enheder vises korrekt formateret.

---

## 2. Dokumentstruktur

Et newCAS-dokument er opbygget hierarkisk:

```
Dokument
├── Eksamenshoved (kun synligt ved print)
│
├── Opgaveblok 1  ──────── scope: task_1
│   ├── Celle [tekst]
│   ├── Celle [matematik] → output
│   ├── Celle [matematik] → output
│   └── Celle [grafik]    → interaktiv graf
│
├── Opgaveblok 2  ──────── scope: task_2
│   ├── Celle [tekst]
│   └── Celle [matematik] → output
│
└── ...
```

Hver **opgaveblok** svarer til en eksamensdels-opgave og har sit eget matematiske scope. Variablen `x` i opgave 1 er uafhængig af `x` i opgave 2.

---

## 3. Celletyper

### Matematikblokke (nuværende)
Kernefunktionaliteten. Eleven skriver matematisk input og trykker Enter.

- Input: én linje matematik (udtryk, tildeling, ligning, funktionskald)
- Output: KaTeX-renderet eksakt resultat + decimaltilnærmelse
- Scope: arver og udvider opgaveblokkenssscope

Eksempel:
```
In [1]:  g := 9,82
In [2]:  f(t) := 1/2 · g · t^2
In [3]:  f(5)
Out[3]:  122,625          ≈ 122,6
```

Semikolon tillader flere beregninger i én celle:
```
In [4]:  a := 3 ; b := 4 ; sqrt(a^2 + b^2)
Out[4]:  5
```

### Tekstblokke (planlagt — Fase 7)
Fri tekst til forklaringer, ræsonnementer og konklusioner. Formatering med Markdown. Matematiske udtryk inline med `$...$`-notation.

Tekstblokke kan referere til variable fra scope: `Den beregnede hastighed er $v$ m/s.`

### Grafikblokke (planlagt — Fase 4)
Output fra `graphplot`, `xyplot`, `boxplot`, `histogram` og `sumcurve`. Renderes med Plotly.js som interaktive grafer med zoom og koordinat-sporing.

Grafikblokke er reaktive: ændres en afhængig variabel opdateres grafen automatisk.

### Datablokke (planlagt — Fase 7)
Tabeldata til statistikberegninger. Manuel indtastning i en tabellignende editor, eller import fra clipboard/Excel. Output kan bruges direkte som input til statistikfunktioner.

---

## 4. Scope og opgaveblokke

Scope-modellen er central for den pædagogiske brugbarhed. Den fungerer således:

- Alle celler inden for en opgaveblok deler ét Python-namespace (`task_id`)
- En variabel defineret i celle 2 er tilgængelig i celle 5 — inden for samme opgave
- Variable fra én opgaveblok er **ikke** tilgængelige i en anden
- `base_context` (SymPy, statistikfunktioner, enheder, konstanter) er altid tilgængeligt i alle scopes

Dette svarer pædagogisk til "et nyt ark papir": eleven starter med en blank tavle for hver opgave, men har stadig adgang til regnemaskinen (base_context).

---

## 5. Settings og tilpasning

Settings tilgås via en panel der åbnes fra navigationsbaren. De er opdelt i tre kategorier:

### Matematiske indstillinger
- **Vinkelmodus:** Grader / Radianer (default: grader)
- **Standarddomæne:** Reelle tal / Komplekse tal (default: reelle)
- **Decimaler:** Antal viste decimaler i numerisk output

### Visuelle indstillinger
- **Tema:** Lys / Mørk / Sepia
- **Skrifttype:** Standard / OpenDyslexic / Mono
- **Skriftstørrelse:** 12 / 14 / 16 / 18 pt

### Elev-identitet (til eksamen)
- Navn, skole, klasse — bruges i eksamenshoved
- Export/import som JSON-fil til maskine-skift

Settings gemmes i `localStorage` og er tilgængelige offline. Det lagdelte settings-system (global → session → lokalt kald) er beskrevet i `Arkitektur_og_dataflow.md`.

---

## 6. Eksamenstilstand og print

Eksamenshovedet indeholder navn, skole, klasse og dato. Det er **kun synligt ved print** — i arbejdsvisningen er det skjult. Eleven printer via browser-print (`Ctrl+P` → "Gem som PDF") og får et professionelt dokument.

Print-CSS sikrer:
- Korrekt paginering uden at splitte celler midt i
- Synligt eksamenshoved på alle sider
- KaTeX-output bevares i PDF (ikke skærmbilleder)
- Grafer eksporteres som vektorgrafik

---

## 7. Tastatur og workflow

newCAS er designet til at bruges primært med tastatur:

| Genvej | Handling |
| :--- | :--- |
| `Enter` | Beregn aktuel celle |
| `Shift+Enter` | Ny linje i celle (tekstblok) |
| `Tab` | Gå til næste celle |
| `Shift+Tab` | Gå til forrige celle |
| `Ctrl+Enter` | Tilføj ny celle under aktuel |
| `Ctrl+Shift+K` | Slet aktuel celle |
| `Ctrl+S` | Gem dokument (download som `.ncas`-fil) |
| `Ctrl+O` | Åbn dokument (fil-vælger) |

---

## 8. Filformat og dokumenthåndtering

### 8.1 Filformatet `.ncas`

Et newCAS-dokument gemmes som en **JSON-fil** med filendelsen `.ncas`. Formatet er åbent og selvbeskrivende — det kan læses og bearbejdes af ethvert program der forstår JSON, ikke kun newCAS. Dette er et bevidst designvalg: elevens arbejde tilhører eleven, ikke programmet.

Filstrukturen:

```json
{
  "format": "newcas",
  "version": "1.0",
  "created": "2026-04-12T09:15:00",
  "modified": "2026-04-12T11:42:00",
  "student": {
    "name": "Mikkel Hansen",
    "school": "Holstebro Gymnasium",
    "class": "3.b"
  },
  "settings": {
    "angleMode": "deg",
    "decimalSeparator": "comma",
    "domain": "R"
  },
  "assignments": [
    {
      "id": "task_1",
      "title": "Opgave 1",
      "cells": [
        {
          "type": "math",
          "input": "g := 9,82",
          "output": { "type": "success" }
        },
        {
          "type": "math",
          "input": "f(t) := 1/2 g t^2",
          "output": { "type": "success" }
        },
        {
          "type": "math",
          "input": "f(5)",
          "output": {
            "type": "scalar",
            "latex": "122{,}625",
            "decimal": "122.625"
          }
        }
      ]
    }
  ]
}
```

Output er gemt i filen som cache — ved genåbning vises tidligere resultater med det samme, uden at genberegne. En eksplicit "Genberegn alt"-funktion er tilgængelig hvis eleven ønsker det.

### 8.2 Autosave og manuel lagring

Elevens arbejde gemmes løbende i **`localStorage`** som autosave. Det sker automatisk ved hver beregning — eleven mister aldrig arbejde ved et utilsigtet lukket vindue.

Manuel lagring sker som download af en `.ncas`-fil via `Ctrl+S` eller en "Gem"-knap. Eleven vælger selv hvad filen hedder og hvor den gemmes.

| Lagringstype | Hvornår | Formål |
| :--- | :--- | :--- |
| `localStorage` autosave | Automatisk ved hver ændring | Nødredning, ingen handling krævet |
| Download som `.ncas` | Manuel (`Ctrl+S`) | Langtidsopbevaring, aflevering, deling |

**`localStorage`-begrænsning:** Browseren sætter typisk en grænse på ca. 5 MB per domæne. Et dokument med mange beregninger kan nærme sig denne grænse. Brugeren advares når dokumentet nærmer sig 80% af kapaciteten.

### 8.3 Åbning af dokumenter

Et gemt dokument kan åbnes på tre måder:

**Fil-vælger:** `Ctrl+O` eller en "Åbn"-knap åbner browserens standard fil-vælger. Eleven navigerer til filen og vælger den.

**Drag-and-drop:** En `.ncas`-fil kan trækkes direkte ind i browservinduet. Adfærden afhænger af dokumentets aktuelle tilstand:

- Er det aktuelle dokument **tomt** (ingen celler med indhold): filen åbnes og erstatter det tomme dokument.
- Er det aktuelle dokument **ikke tomt**: filen *indsættes* som nye opgaveblokke. Indsætningspunktet er den opgaveblok der var i fokus da filen blev sluppet — de nye opgaver indsættes efter denne blok, men før den næste. Eleven bekræfter med en dialog: *"Indsæt 3 opgaver fra 'Opgave2b.ncas' efter 'Opgave 1'?"*

Dette gør det muligt at sammensætte et eksamensdokument fra flere separate filer, f.eks. én fil per dag i eksamensforberedelsen.

**Fra `localStorage`:** Ved opstart af programmet tjekkes om der er et autogemt dokument. Hvis ja, tilbydes eleven at fortsætte fra sidst.

### 8.4 Elev-profil og maskinskift

Elev-identitet (navn, skole, klasse) og settings gemmes separat som en **profil-fil** (`.ncas-profile`), der ligeledes er JSON. Eleven eksporterer profilen fra én maskine og importerer den på en anden — f.eks. fra hjemmecomputeren til skolens eksamensmaskine.

Profilen indeholder **ikke** dokumentindhold — kun identitet og indstillinger. Den er lille (< 1 KB) og let at sende til sig selv pr. e-mail eller bære på en USB-nøgle.

---

## 9. Åbne designspørgsmål

**Reaktiv genberegning.** Skal ændring af en variabel (`g := 9,82` → `g := 9,81`) automatisk genberegne alle afhængige celler? Det er et stærkt pædagogisk feature, men kræver en dependency-graf og er ikke trivielt at implementere korrekt uden at skabe forvirring.

**Multi-linje input.** Skal én celle kunne indeholde et flerlinjet program (løkker, betingelser)? I dag understøttes dette delvist via semikolon-separator. Fuld multi-linje ville kræve en mere avanceret editor (CodeMirror/Monaco).

**Cellemærker.** Skal `In [1]:` / `Out[1]:`-notationen bibeholdes (Jupyter-stil), eller er det teknisk støj der ikke gavner eleven?

**Versionering af filformatet.** `format: "newcas", version: "1.0"` er reserveret i JSON-strukturen. Når formatet ændrer sig (nye celletyper, nye output-felter) skal der være en migreringslogik der kan opgradere ældre filer. Dette bør planlægges allerede nu, selv om det ikke implementeres endnu.

---

*Rev. 120426 · Erstatter: `Bruger_interface_og_interaktionsdesign.md (uden rev.)`*
