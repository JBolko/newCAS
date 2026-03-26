# Projekt Roadmap: newCAS

Dette dokument beskriver udviklingsfaserne for CAS-motoren. Målet er at skabe et værktøj, der er både matematisk robust og pædagogisk tilgængeligt (især for ordblinde).

## 🟢 Fase 1: Fundament (Færdiggjort)
- [x] Grundlæggende arkitektur (ES6 moduler).
- [x] Integreret Peggy-parser til matematisk notation.
- [x] Basal AST-til-Python transformer.
- [x] Pyodide/SymPy integration i browseren.
- [x] GitHub repository etableret.

## 🟡 Fase 2: Det Intelligente Output (Næste skridt)
- [ ] **Struktureret Returobjekt:** Python skal returnere JSON med:
    - `type` (Scalar, List, Matrix, Piecewise, etc.).
    - `latex` (Via SymPy's `latex()`).
    - `domain` (Reals, Integers, etc.).
- [ ] **KaTeX Integration:** Rendering af LaTeX-output i UI.
- [ ] **Settings-modul:** Håndtering af decimaler (komma vs. punktum) og vinkler (deg/rad).
- [ ] **Scope-håndtering:** Isolation af variable mellem forskellige beregninger.

## 🟠 Fase 3: Avanceret Matematik & Notation
- [ ] **Intervaller:** Understøttelse af notation som $2 < x \le 4$ i parseren.
- [ ] **Gaffelfunktioner:** Implementering af `Piecewise` syntaks og logik.
- [ ] **Definitionsmængder:** Kobling af funktioner med deres gyldighedsområde.
- [ ] **Vektorer & Matricer:** Fuld understøttelse af lineær algebra notation.

## 🔵 Fase 4: Visualisering & Statistik
- [ ] **Plot-kontrakt:** Definition af dataformat til grafer.
- [ ] **Funktionsplotter:** Rendering af 2D grafer (f.eks. via Plotly eller Chart.js).
- [ ] **Statistik-moduler:** Boksplot, histogrammer, sumkurver og scatterplots.
- [ ] **Data-import:** Mulighed for at håndtere lister af datapunkter fra f.eks. Excel.

## 🟣 Fase 5: UI & Tilgængelighed
- [ ] **Syntaktisk Sukker:** Pre-processor til at gøre input mere "dovent" (f.eks. `3x` -> `3*x`).
- [ ] **A11y Optimering:** Farvetemaer (sepia/dark) og skrifttype-indstillinger til ordblinde.
- [ ] **Print-layout:** CSS-optimering til pæne udskrifter af matematiske rapporter. 