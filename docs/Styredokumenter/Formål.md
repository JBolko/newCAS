# Formål og vision — newCAS
*Rev. 120426*

---

## 1. Overordnet vision

newCAS er et samlet, pædagogisk og eksamensegnet arbejdsredskab for matematik og fysik på STX og HF. Det er ikke en lommeregner — det er et **digitalt arbejdspapir**, hvor tekst, symbolsk matematik, grafer og tabeller indgår i ét sammenhængende dokument.

Programmet skal understøtte hele arbejdsprocessen:

- **Modellering** — eleven opstiller og definerer variable, funktioner og sammenhænge
- **Beregning** — symbolsk og numerisk matematik via en professionel CAS-motor
- **Visualisering** — interaktive grafer og statistiske diagrammer direkte i dokumentet
- **Dokumentation** — forklaringer, ræsonnementer og konklusioner i samme dokument som beregningerne
- **Aflevering** — print-venligt output med eksamenshoved, klar til PDF-eksport

Eleven skal aldrig behøve at tage et skærmbillede eller skifte program.

---

## 2. Pædagogiske mål

newCAS er designet ud fra tre pædagogiske kerneprincipper:

**Begrebsforståelse frem for kommandomestring.** Syntaksen skal være så tæt på matematisk notation som muligt, så eleven tænker i matematik — ikke i programmeringssyntaks. `sin(30)` skal virke i grader. `3x` skal forstås som `3·x`. `f'(x)` skal virke som notationen i bogen.

**Dokumentation som naturlig del af arbejdet.** Tekst og matematik skal leve side om side. Eleven skriver ikke sin besvarelse ét sted og beregner et andet — arbejdet foregår i ét dokument fra start til slut.

**Reduktion af teknisk støj.** Scope-isolation betyder at variablen `x` i opgave 1 ikke forstyrrer `x` i opgave 3. Genberegning sker automatisk. Eleven skal aldrig fejlsøge i systemet — kun i matematikken.

---

## 3. Sammenligning med eksisterende værktøjer

Ingen af de nuværende alternativer løser hele opgaven:

| Værktøj | Hvad det gør godt | Hvad det mangler |
| :--- | :--- | :--- |
| **TI-Nspire** | Stærk CAS, lokal opgavehåndtering | Fragmenteret dokumentstruktur, svag grafik, dyr hardware |
| **GeoGebra** | Fremragende interaktiv grafik | Svag CAS, ringe dokumentation, serverkrævende |
| **WordMat** | God integration af tekst og matematik | Manglende reaktivitet, globalt scope, kun Windows |
| **Maple/Mathematica** | Professionel CAS og dokumentation | Ikke gratis, ikke browserbaseret, for kompleks syntaks |

newCAS kombinerer det bedste fra hver kategori og tilføjer det, alle mangler: dansk notation, offline-first og et rent pædagogisk fokus.

---

## 4. Teknologiske grundprincipper

Disse principper er ikke til forhandling — de er forudsætninger for at programmet kan bruges til eksamen og i undervisning:

**Browserbaseret.** Ingen installation. Eleven åbner en URL og er i gang. Virker på skolens computere, hjemme og på eksamensdagen.

**Offline-first.** Efter første indlæsning kører programmet uden internetforbindelse. Dette er et krav til eksamensbrug, hvor netadgang kan være begrænset eller upålidelig.

**Cross-platform.** Windows, macOS, Linux og Chromebook. Programmet skelner ikke.

**Open source.** Koden er tilgængelig, inspicerbar og modificerbar. Ingen black box, ingen licenskrav, ingen vendor lock-in.

**Ingen serverafhængighed.** Alle beregninger sker lokalt i elevens browser via WebAssembly. Der sendes ingen data til en server. Maksimalt privatliv.

---

## 5. Målgruppe

Den primære målgruppe er **elever på STX og HF** i matematik på B- og A-niveau og fysik på B- og A-niveau.

Sekundært: matematiklærere der ønsker et frit, tilpasseligt og gennemskueligt alternativ til kommercielle CAS-systemer.

Programmet er designet med særligt hensyn til elever med **ordblindhed** — tilgængelighed i form af skrifttyper, kontrast og farvetemaer er en integreret del af designet, ikke en eftertanke.

### Langsigtet mål: skærmlæserkompatibilitet

Et langsigtet tilgængelighedsmål er fuld kompatibilitet med skærmlæsere (NVDA, JAWS, VoiceOver). Dette er teknisk realistisk, fordi **KaTeX** — som allerede er valgt som renderingsteknologi — genererer **MathML** side om side med den visuelle LaTeX-rendering. MathML er det format skærmlæsere forstår og kan oplæse matematiske udtryk fra.

Det betyder at en elev med et synshandicap eller svær ordblindhed med den rette opsætning vil kunne høre `x^2 + 2x + 1` oplæst som "x i anden plus to x plus et" — direkte fra programmets output uden ekstra hjælpemidler.

For at dette virker i praksis kræves:
- KaTeX renderes med `output: 'htmlAndMathml'` (ikke kun HTML, som er default)
- HTML-strukturen er korrekt semantisk opmærket med ARIA-labels
- Tekstblokke er tilgængelige som plain text, ikke billeder
- Fokus-håndtering og tastaturnavigation er fuldt implementeret

Dette arbejde hører hjemme i Fase 7 (UI/UX og tilgængelighed) men det er en forudsætning at KaTeX-konfigurationen sættes korrekt fra starten, da det er dyrt at retrofitte.

---

*Rev. 120426 · Dette dokument erstatter ikke andre dokumenter*
