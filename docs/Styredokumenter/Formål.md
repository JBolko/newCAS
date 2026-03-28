
# Formål og vision for CAS-programmet

## 1. Overordnet vision

Dette CAS-program (Computer Algebra System) er designet som et samlet,
pædagogisk og eksamensegnet arbejdsredskab for matematik og fysik
på STX og HF.

Programmet skal understotte hele arbejdsprocessen:
- forståelse og modellering
- beregning
- visualisering
- dokumentation
- aflevering

Visionen er at skabe et værktøj, hvor tekst, symbolsk matematik,
grafer og tabeller indgår i eet sammenhængende dokument.

Programmet er ikke en traditionel lommeregner,
men et digitalt arbejdspapir.

## 2. Pædagogiske mål

- understotte begrebsforståelse frem for mekanisk kommandoanvendelse
- gøre dokumentation til en naturlig del af arbejdet
- reducere teknisk støj (scope, globale variable, genberegning)

Eleverne skal kunne dokumentere hele deres fremgangsmåde uden skærmbilleder eller eksterne programmer.

## 3. Forhold til eksisterende værktøjer

#### TI-Nspire:
- stærk CAS
- god lokal opgavehåndtering
- men fragmenteret dokumentstruktur og svag grafik

#### GeoGebra:
- stærk grafik
- men svag CAS og ringe dokumentation

#### WordMat:
- god tekstintegration
- men manglende reaktivitet og global genberegning

CAS-programmet kombinerer:
- lokale scopes
- stærk symbolsk matematik
- korrekt enhedshåndtering
- reaktiv opdatering
- fuld dokumentation i eet dokument

## 4. Teknologiske grundprincipper

- browserbaseret
- offline-first
- cross-platform (Windows, macOS, Linux, Chromebook)
- open source
- ingen serverafhængighed

CAS-motoren er baseret på Python og SymPy kørt i browseren via WebAssembly (Pyodide).
