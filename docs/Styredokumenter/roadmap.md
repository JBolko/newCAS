# 🗺️ Master-Roadmap: newCAS (Rev. 070426)

Dette dokument er det centrale styredokument for udviklingen af newCAS. Det kombinerer den pædagogiske vision med de tekniske krav for at sikre en stabil og tilgængelig CAS-oplevelse.

## 🟢 Fase 0: Fundament (Færdiggjort)
- [x] Grundlæggende arkitektur (ES6 moduler).
- [x] Integreret Peggy-parser til matematisk notation.
- [x] Basal AST-til-Python transformer.
- [x] Pyodide/SymPy integration i browseren.
- [x] Skift til Notebook-layout (Celle-baseret UI).
- [x] Etableret JSON-kommunikation mellem JS og Python.

## 🔴 Fase 1: Parser-Transformer Synkronisering (HØJESTE PRIORITET)
*Mål: Sikre at alt brugerinput når korrekt frem til SymPy uden "kryptiske fejl".*

- [ ] **Grammatik-fix (PEG.js):**
    - [ ] **Equation:** Gør `Equation` til en `Statement`, så `2x + 1 = 5` kan parses direkte som en ligning.
    - [ ] **Dansk Decimal:** Opdater `Number`-reglen til at acceptere `,` som decimaltegn.
    - [ ] **Argument Separator:** Skift fra `,` til `;` i funktionskald (f.eks. `f(1,5 ; 2,3)`), så vi kan kende forskel på decimaltal og argumenter.
- [ ] **Transformer-overhaling (`transformer.js`):**
    - [ ] **Implementer noder:** Tilføj `Vector`, `Quantity` (enheder) og `Access` (liste-index).
    - [ ] **Cleanup:** Fjern dubleret `Literal` case og optimer AST-gennemgang.
- [ ] **Build-pipeline:**
    - [ ] Tilføj `peggy` til `package.json`.
    - [ ] Lav `npm run build:parser` script for automatisk generering af `parser.mjs`.

## 🟡 Fase 2: Matematisk Korrekthed & Output
*Mål: Eleven skal kunne stole på resultaterne, og de skal præsenteres professionelt.*

- [ ] **Vinkel-logik (Angle Mode):**
    - [ ] Kobl `settings.js` til transformeren (automatisk konvertering til `rad` ved `deg`).
- [ ] **Namespace Sikkerhed:**
    - [ ] Ryd op i `setup.py` (fjern `import *`) for at beskytte indbyggede variabler som `N`, `E`, `I`.
- [ ] **Smart Output:**
    - [ ] Skjul decimal-output for rent symbolske resultater (undgå rod som `x - 1.0`).
    - [ ] Formatering af lister/mængder med professionel LaTeX ($\left\{ ... \right\}$).

## 🟠 Fase 3: Arkitektonisk Opstramning & Performance
*Mål: Gør programmet hurtigt og sørg for isolation mellem opgaver.*

- [ ] **Scope Isolation:**
    - [ ] Implementer uafhængige namespaces per `assignment`-blok i UI'en (Opgave 1 må ikke forstyrre Opgave 2).
- [ ] **Web Worker Integration:**
    - [ ] Flyt Pyodide til en Web Worker for at undgå, at brugerfladen fryser under indlæsning.
- [ ] **Caching & Offline:**
    - [ ] Service Worker til lokal lagring af SymPy-pakker for lynhurtig opstart.

## 🔵 Fase 4: Avanceret Notation & Visualisering
*Mål: Understøttelse af fuldt gymnasiepensum.*

- [ ] **Intervaller & Logik:** Understøttelse af notation som $2 < x \le 4$ og `Piecewise`.
- [ ] **Vektorer & Matricer:** Fuld understøttelse af lineær algebra notation og operationer.
- [ ] **Grafer:** Definition af plot-kontrakt og implementering af 2D plot-motor.

## 🟣 Fase 5: Kvalitetssikring & Tilgængelighed
*Mål: Robusthed og optimering til ordblinde/eksamensbrug.*

- [ ] **Regressionstests:** Mindst 30-50 automatiserede test-cases for standardstykker (brøker, ligninger, enheder).
- [ ] **A11y:** Specielle skrifttyper til ordblinde og optimerede kontrast-temaer.
- [ ] **Print-layout:** CSS-optimering til pæne PDF-afleveringer, der overholder eksamenskrav.

---
*Sidst opdateret: 7. april 2026 (Rev. 070426)*