# 🗺️ newCAS — Master Roadmap
**Rev. 120426** · Erstatter: `roadmap.md (Rev. 070426)`, `Strategisk_udviklingsplan.md`

---

## Vision

newCAS er et samlet, pædagogisk og eksamensegnet arbejdsredskab for matematik og fysik på STX og HF. Programmet er ikke en lommeregner — det er et digitalt arbejdspapir, hvor tekst, symbolsk matematik, grafer og tabeller indgår i ét sammenhængende dokument, og hvor hele arbejdsprocessen fra modellering til aflevering foregår.

Programmet adskiller sig fra eksisterende værktøjer ved at kombinere det, de hver for sig mangler:

| Værktøj | Styrke | Svaghed |
| :--- | :--- | :--- |
| TI-Nspire | Stærk CAS, lokal opgavehåndtering | Fragmenteret dokumentstruktur |
| GeoGebra | Stærk grafik | Svag CAS, ringe dokumentation |
| WordMat | God tekstintegration | Manglende reaktivitet |
| **newCAS** | CAS + dokumentation + grafik i ét | — |

**Teknologiske grundprincipper:** Fuldt browserbaseret, offline-first, cross-platform (Windows/macOS/Linux/Chromebook), open source, ingen serverafhængighed. Motoren kører Python og SymPy lokalt i browseren via WebAssembly (Pyodide).

---

## Testfilosofi

Det er et grundmantra for projektet: **matematikken må aldrig fejle uden at eleven ved det.**

- Alle matematiske funktioner skal have mindst 5 tilhørende E2E-tests før de betragtes som færdige
- Vi har tre testniveauer: `test-parser.html` (grammatik), `test-transformer.html` (AST→Python), `test-e2e.html` (hele kæden inkl. SymPy)
- Vi rører ikke ved UX-design seriøst, før E2E-testsuiten lyser grønt på hele gymnasiepensum
- En ny funktion er ikke "klar" fordi den virker i browseren — den er klar når testen godkender den

---

## Status: Hvad er færdigt

### ✅ Fundament
- Modulær ES6-arkitektur med clean pipeline: `parser → transformer → engine → UI`
- Peggy-grammatik med dansk notation: komma-decimal, semikolon som arg-separator, implicit multiplikation, lange variabelnavne
- Alle AST-nodetyper implementeret: `BinaryExpression`, `PowerExpression`, `UnaryExpression`, `FunctionCall`, `Assignment`, `FunctionDefinition`, `Equation`, `List`, `Vector`, `Quantity`, `Access`, `Conversion`
- Transformer kobler korrekt til SymPy inkl. enhedskonvertering og trigonometri i grader/radianer
- `setup.py` med scope-isolation via `run_in_task`, auto-symbol-oprettelse, `wrap_result` med JSON-output
- Settings-modul med localStorage-persistens; `angleMode`, `decimalSeparator` koblet til transformer
- Notebook-UI med celle-baseret input og KaTeX-rendering

### ✅ Matematik der virker (bekræftet af testsuiten)
- Grundlæggende aritmetik inkl. dansk komma-decimal
- Symbolsk matematik: `simplify`, `factor`, `expand`, `diff`, `integrate`
- Ligninger: `solve` med én og to løsninger, komplekse rødder
- Scope: tildelinger persisterer inden for opgave, isolation mellem opgaver
- Funktionsdefinitioner og Lambda
- Statistik: `mean`, `median`, `Q1`, `Q3`, `min`, `max`
- Enheder og konvertering: `[m]`, `[km/h]`, `-> [m/s]` osv.
- Trigonometri: `sin`, `cos`, `tan`, `asin`, `acos`, `atan` i både grader og radianer

---

## Fase 1 — Motor-finpudsning
*Mål: Fjern de kendte svage punkter og sørg for at motoren er "skudsikker". Ingen nye features.*

### 1.1 Output-rensning i `wrap_result` (Prioritet: høj)
Decimal-feltet er nu korrekt numerisk, men LaTeX-outputtet for enheder er ikke rigtig LaTeX. `5 \text{m}` bør være `5\,\mathrm{m}`, og `\frac{9.82\text{m}}{\text{s}^{2}}` kan forenkles. Der skal defineres et klart format for alle output-typer:

| Resultattype | latex-felt | decimal-felt |
| :--- | :--- | :--- |
| Heltal | `"5"` | `"5"` |
| Brøk | `\frac{1}{2}` | `"0.5"` |
| Symbolsk | `x^{2} + 2x` | `"x**2 + 2.0*x"` (evt. skjult) |
| Med enhed | `5\,\mathrm{m}` | `"5.0"` |
| Liste | `\left\{-2,\,2\right\}` | `"-2, 2"` |

Decimal-feltet bør skjules helt for rent symbolske resultater (`is_symbolic: true` og ingen numerisk værdi).

### 1.2 Rettelse af assignment-detektion i `run_in_task` (Prioritet: høj)
`":=" in last_line`-tjekket i `run_in_task` fanger false positives — f.eks. `solve(x^2 - 4 = 0; x)` indeholder `=` og hoppes over. Skal erstattes med et korrekt regex der kun matcher Python-tildelinger: `^[a-zA-Z_]\w*\s*=\s*(?!=)`.

### 1.3 Fejlhåndtering (Prioritet: middel)
Rå Python-tracebacks må ikke vises for eleven. `wrap_result`'s `except`-gren returnerer `str(e)` som kan indeholde Python-intern information. Der skal laves en `classify_error(e)`-funktion der oversætter kendte fejltyper til pædagogiske danske beskeder:
- `ZeroDivisionError` → "Division med nul er ikke defineret"
- `NameError: name 'x' is not defined` → "Variablen x er ikke defineret i denne opgave"
- SymPy `NonInvertibleMatrixError` → "Matricen er ikke inverterbar"
- Fallback → generisk teknisk besked med fejltype

### 1.4 Build-pipeline (Prioritet: lav, men vigtig for arbejdsflow)
Grammatikfilen `docs/Grammatik.pegjs` og den kompilerede `src/js/parser.mjs` er manuelt synkroniserede. Tilføj til `package.json`:
```json
"devDependencies": { "peggy": "^4.x" },
"scripts": {
  "build:parser": "peggy docs/Grammatik.pegjs -o src/js/parser.mjs",
  "build": "npm run build:parser"
}
```

---

## Fase 2 — Statistik og sandsynlighed
*Mål: Dæk hele gymnasiepensum i statistik. Dette er det mest efterspurgte faglige indhold.*

Motor-strategi: Indlæs `numpy` og `scipy` som Pyodide-pakker i `cas-engine.js`. Det øger opstartstiden med ca. 5-8 sekunder, men giver adgang til professionelle algoritmer frem for hjemmebyggede approximationer.

### 2.1 Regression
Alle regressionsfunktioner returnerer et struktureret objekt med koefficienter, funktionsudtryk og R²-værdi.

```
linReg(x_data; y_data)          → lineær regression: y = ax + b
expReg(x_data; y_data)          → eksponentiel: y = a·e^(bx)
powReg(x_data; y_data)          → potensfunktion: y = a·x^b
logReg(x_data; y_data)          → logaritmisk: y = a·ln(x) + b
logisticReg(x_data; y_data)     → logistisk: y = c/(1+a·e^(-bx))
```

Implementation via `scipy.optimize.curve_fit` (non-lineær) og `numpy.polyfit` (lineær). Returformat:
```json
{
  "type": "regression",
  "latex": "y = 2{,}3x + 1{,}7",
  "coefficients": {"a": 2.3, "b": 1.7},
  "r_squared": 0.987,
  "function_name": "f"  // hvis eleven navngav den: f := linReg(...)
}
```

### 2.2 Sandsynlighedsfordelinger
```
binompdf(n; p; x)               → P(X = x) for X ~ B(n,p)
binomcdf(n; p; a; b)            → P(a ≤ X ≤ b)
normalcdf(mu; sigma; a; b)      → P(a ≤ X ≤ b) for X ~ N(μ,σ)
normpdf(mu; sigma; x)           → tæthedsfunktionsværdi
poissonpdf(lambda; x)           → P(X = x) for X ~ Po(λ)
poissoncdf(lambda; a; b)        → P(a ≤ X ≤ b)
```

Syntaktisk sukker (via preprocessor eller grammatik):
```
X ~ b(n; p)     → definerer stokastisk variabel X
P(X = k)        → binompdf
P(a <= X < b)   → binomcdf med korrekte grænser
```

### 2.3 Hypotesetest
```
binomtest(x; n; p0; side)       → binomialtest, returnerer p-værdi og konklusion
chi2GOF(observed; expected)     → goodness-of-fit test
chi2Independence(matrix)        → uafhængighedstest
ttest(data; mu0)                → en-stikprøve t-test
ttest2(data1; data2)            → to-stikprøve t-test
```

Returformat for hypotesetest:
```json
{
  "type": "hypothesis_test",
  "test_name": "Binomialtest",
  "test_statistic": 2.34,
  "p_value": 0.032,
  "alpha": 0.05,
  "conclusion": "Forkast H₀ (p = 0,032 < α = 0,05)",
  "latex": "p\\text{-værdi} = 0{,}032"
}
```

### 2.4 Udvidede statistiske mål
```
variance(data)                  → varians
sd(data)                        → standardafvigelse
quartiles(data)                 → alle fire kvartiler
IQR(data)                       → interkvartilbredde
frequencyTable(data)            → frekvenstabel (rå + relativ + kumulativ)
```

---

## Fase 3 — Algebra og analyse (fuldt gymnasiepensum)
*Mål: Alle standard matematikopgaver på STX A-niveau.*

### 3.1 Calculus-udvidelser
```
derivative(f; x)                → f'(x), allerede via diff()
derivative(f; x; n)             → n'te afledte
limit(f(x); x; a)               → grænseværdi
integrate(f; x; a; b)           → bestemt integral
arclength(f; x; a; b)           → kurvelængde ∫√(1+f'²) dx
```

Notation-sukker — disse oversættes i transformerlaget:
```
f'(x)    → diff(f(x), x)
f''(x)   → diff(f(x), x, 2)
```

### 3.2 Komplet ligningshåndtering
```
solve(eq; var)                  → allerede implementeret
solve({eq1; eq2}; {x; y})       → ligningssystem (to eller flere variable)
isolate(expr; var)              → isoler variabel (uden at løse numerisk)
completesquare(expr; var)       → fuldstændig kvadratsætning
```

### 3.3 Vektorer og lineær algebra
Vektorer er allerede parsebare som `[x; y; z]` og transformeres til SymPy `Matrix`. Det der mangler er de tilhørende operationer:
```
dotP(u; v)                      → prikprodukt
crossP(u; v)                    → vektorprodukt (3D)
norm(v)                         → vektorlængde
angle(u; v)                     → vinkel mellem vektorer (respekterer angleMode)
det(M)                          → determinant
inv(M)                          → invers matrix
```

### 3.4 Intervaller og gaffelfunktioner
```
piecewise(cond1: expr1; cond2: expr2; ...)   → stykvist defineret funktion
solve(expr; x; domain: Reals)               → løsning begrænset til reelle tal
```

Grammatik-udvidelse: understøttelse af `2 < x ≤ 4` som interval-notation, der parser til SymPy `Interval`.

---

## Fase 4 — Visualisering
*Mål: Interaktive grafer direkte i notebook-dokumentet.*

**Teknologivalg: Plotly.js** (frem for Matplotlib). Python-motoren genererer datapunkter som JSON, JavaScript-laget tegner grafen interaktivt. Det giver zoom, koordinat-sporing og graf-eksport direkte i browseren.

### 4.1 Funktionsplot
```
graphplot(f; interval)           → plot f(x) over interval [a;b]
graphplot({f; g}; interval)      → flere funktioner i samme koordinatsystem
```

Returformat fra Python:
```json
{
  "type": "plot",
  "series": [
    { "label": "f(x) = x²", "x": [...], "y": [...] }
  ],
  "x_range": [-5, 5],
  "y_range": [-1, 25]
}
```

### 4.2 Data-plot
```
xyplot(x_data; y_data)          → punktplot (scatter)
xyplot(x_data; y_data; f)       → punktplot med regressionskurve
boxplot(data)                   → boksplot
histogram(data)                 → histogram med valgfrit klasseantal
sumcurve(data)                  → sumkurve (kumulativ fordeling)
```

### 4.3 Statiske statistikdiagrammer
Boksplot og histogrammer kan alternativt genereres som SVG direkte fra Python (via `matplotlib.figure` i headless-mode i Pyodide) og sendes som base64-streng. Dette evalueres når fase 4.2 er på plads.

---

## Fase 5 — Arkitektur: WebWorker og caching
*Mål: Gør programmet hurtigt og responsivt.*

### 5.1 WebWorker-migrering
`CASEngine` flyttes fra UI-tråden til en dedikeret Web Worker. Kommunikationen sker via `postMessage` med et simpelt besked-format:

```javascript
// UI → Worker
{ type: 'calculate', taskId: 'task_1', code: 'sin(30)' }

// Worker → UI
{ type: 'result', taskId: 'task_1', result: { type: 'scalar', latex: ... } }
```

Gevinsten er at browseren ikke fryser under tunge beregninger (integration, regression, store ligningssystemer). Eleven kan skrive videre, mens motoren regner.

### 5.2 Service Worker og offline-caching
Pyodide + SymPy er ca. 30 MB. Service Worker cacher dem i `Cache API` efter første indlæsning, så genbesøg er næsten øjeblikkelige. Under første indlæsning vises en fremskridtsindikator med realistisk estimat.

---

## Fase 6 — Elev-identitet, settings og eksamen
*Mål: Systemet skal kunne bruges til eksamen.*

### 6.1 Elev-profil
Navn, skole og klasse gemmes i `localStorage` via `SettingsManager`. Export/import som JSON-fil til den sjældne situation hvor eleven skifter maskine.

```json
{
  "student": { "name": "...", "school": "...", "class": "..." },
  "math": { "angleUnit": "degrees", "domain": "R", "decimalSeparator": "comma" },
  "ui": { "theme": "sepia", "font": "OpenDyslexic" }
}
```

### 6.2 Eksamenshoved
Student-info renderes i et `<header>`-element der kun er synligt under `@media print`. Browseren genererer eksamensdokumentet via `Ctrl+P` → PDF — ingen PDF-bibliotek nødvendigt.

### 6.3 Lagdelt settings-system
Tre lag, som beskrevet i arkitekturdokumentet:
1. **Global** (localStorage): elevens standardindstillinger
2. **Session**: kan overstyres med `set(grader)` øverst i en session
3. **Lokalt kald**: eksplicit enhed i funktionskald, f.eks. `sin(30; rad)`

Settings sendes altid som et immutabelt objekt til engine — aldrig som global mutable state.

---

## Fase 7 — UI/UX og tilgængelighed
*Mål: Et professionelt og tilgængeligt arbejdsredskab.*

Dette er bevidst placeret sidst. Vi rører ikke UI seriøst, før motoren lyser grønt.

### 7.1 Bloktyper i notebook
- **Matematikblokke**: nuværende celle-type, input → beregning → KaTeX-output
- **Tekstblokke**: Markdown + LaTeX til forklaringer og ræsonnementer
- **Grafikblokke**: output fra `graphplot`, `boxplot` osv.
- **Datablokke**: tabeldata, manuel indtastning, import fra Excel og clipboard

### 7.2 Tilgængelighed
- Farvetemaer: lys, mørk, sepia
- Skrifttype-valg inkl. OpenDyslexic
- Øget kontrast-tilstand
- Tastatur-navigation

### 7.3 Print og eksport
- `@media print` CSS med korrekt paginering og eksamenshoved
- PDF-venligt output af hele notebook
- Eksport af enkeltresultater til clipboard som LaTeX

---

## Åbne designspørgsmål

Disse spørgsmål er ikke besvaret endnu og vil forme beslutninger i Fase 3-7:

**Sessionmodel:** Skal eleven arbejde i en "aktiv fil" (worksheet-model som Maple), eller er localStorage + export/import tilstrækkeligt? Worksheet-modellen er mere kraftfuld men langt mere kompleks.

**Syntaktisk sukker for sandsynlighed:** Notationen `P(X = k)` og `X ~ b(n;p)` kræver enten en preprocessor-fase eller en grammatikudvidelse. Preprocessor er enklere men kræver et ekstra lag. Grammatikudvidelse er mere konsistent men sværere at vedligeholde.

**Reaktiv genberegning:** Skal ændring af én celle automatisk genberegne afhængige celler? Det er et stærkt pædagogisk feature (som i et regneark), men kræver en dependency-graf og er ikke trivielt at implementere korrekt.

**Enhedsstrenge i LaTeX-output:** Den nuværende `5\,\text{meter/100}` er ikke pæn. Der skal defineres en enhedsformatter der konverterer SymPy-enhedsobjekter til pæn LaTeX som `5\,\mathrm{cm}`.

---

## Næste konkrete handlinger

I prioriteret rækkefølge:

1. Ret assignment-detektion i `run_in_task` (linje med `":="` tjek)
2. Definér og implementér det endelige output-format for alle result-typer (Fase 1.1)
3. Implementér `classify_error()` til pædagogiske fejlbeskeder
4. Tilføj peggy til package.json og lav build-script
5. Indlæs scipy og numpy i cas-engine.js og verificér opstartstid
6. Implementér `linReg` og `expReg` med E2E-tests
7. Implementér `binompdf`, `binomcdf`, `normalcdf` med E2E-tests

---

*Rev. 120426 · Sidst opdateret: 12. april 2026*
*Erstatter: `roadmap.md (Rev. 070426)`, `Strategisk_udviklingsplan.md`*
*Supplerer (erstatter ikke): `Formål.md`, `Arkitektur_og_dataflow.md`, `Funktionskatalog.md`*
