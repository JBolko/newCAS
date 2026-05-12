# newCAS Roadmap — Status Maj 2026

## ✅ FASE 1: CORE ENGINE (FÆRDIG!)

**Periode:** Jan–Apr 2026

### Parser & Transformer
- ✅ Peggy-baseret parser med dansk notation (komma-decimal, semikolon-separator)
- ✅ Implicit multiplikation og eksponentieringsordning
- ✅ FunctionDefinition (`f(x) := ...`) → Python `def`
- ✅ Assignment (`a := 5`) med persistens på tværs af celler
- ✅ DerivativeCall (`f'(x)`, `f''(x)`) med apostrof-notation
- ✅ Quantity (`5[m]`) og Conversion (`5[m] -> [cm]`)
- ✅ Danske bogstaver (æ, ø, å) i variabelnavne

### Executor & Scope
- ✅ Task-baseret scope (hver celle isoleret med persistens mellem celler)
- ✅ ScopedGlobals — `def`-funktioner kan se task-lokale variabler
- ✅ Auto-symbol-injektion (ukendte variabler bliver Symbol automatisk)
- ✅ FunctionDefinition som Python `def` (ikke Lambda) for korrekt scope

### Matematik & Calculus
- ✅ Basis aritmetik (inkl. implicit multiplikation)
- ✅ Symbolsk matematik (auto-simplificering via SymPy)
- ✅ Trigonometri med grader/radianer-mode (angleMode setting)
- ✅ `diff(f; x)`, `diff(f; x; n)` — n'te afledte
- ✅ `integrate(f; x)` — ubestemt integral
- ✅ `integrate(f; x; a; b)` — bestemt integral
- ✅ `limit(f; x; a)` — grænseværdi
- ✅ `limit(f; x; a; højre/venstre)` — ensidede grænser
- ✅ `arclength(f; x; a; b)` — kurvelængde
- ✅ `solve(ligning; variabel)` — ligningsløsning

### Statistik
- ✅ `mean(data)`, `median(data)`
- ✅ `Q1(data)`, `Q3(data)` — kvartiler
- ✅ `min()`, `max()`

### Regression (Pure Python, ingen NumPy)
- ✅ `linReg([x], [y])` — lineær regression y = ax + b
- ✅ `expReg([x], [y])` — eksponentiel y = a·e^(bx)
- ✅ `powReg([x], [y])` — potens y = a·x^b
- ✅ `logReg([x], [y])` — logaritmisk y = a + b·ln(x)
- ✅ Alle returnerer {a, b, r²} med LaTeX-output

### Enhedssystem
- ✅ SI-enheder (m, kg, s, K, A, Pa, J, W osv.)
- ✅ Afledede enheder (km/h, m/s, mA osv.)
- ✅ `convert_to_unit(værdi, "target")` for konvertering
- ✅ Konstant `g = 9.82 m/s²` i base_context

### Fejlhåndtering
- ✅ Strukturerede fejlobjekter med danske beskeder
- ✅ `ZERO_DIVISION`, `UNDEFINED_NAME`, `PYTHON_ERROR` osv.
- ✅ Domain-advarelser (`COMPLEX_RESULT` for √(-4))
- ✅ `type='warning'` for domænefejl vs. `type='error'` for kritiske fejl

### Frontend & Output
- ✅ KaTeX-rendering med dansk notation (`output: 'htmlAndMathml'` for skærmlæsere)
- ✅ `type: 'scalar'`, `'symbolic'`, `'list'`, `'equation'`, `'regression'`, `'warning'`, `'error'`
- ✅ `latex` felt med TeX-formatering
- ✅ `decimal` felt med numerisk approksimation
- ✅ `source` felt for fejldiagnostik

### Test Suite
- ✅ **120 E2E-tests** (alle bestået)

---

## ✅ FASE 1B: ARKITEKTUR-KONSOLIDERING (FÆRDIG — Maj 2026)

*Ekstra fase der ikke stod i den originale plan men var nødvendig inden videre bygning.*
*En ustabil arkitektur giver mere gæld end features. Det er betalt nu.*

### Python-lag
- ✅ `cas_math` refactored til rene, adskilte moduler: `calculus`, `statistics`, `distributions`, `registry`
- ✅ `registry.py` er nu udelukkende et registreringsled — ingen implementations-kode
- ✅ SymPy-imports med `_`-aliaser øverst i hvert modul (undgår lokale re-imports inde i funktioner)
- ✅ `distributions.py` bugfixet: dobbelt `_to_int`-definition fjernet, `invnorm` fortegn rettet (P(X≤x)=0.84 → x≈1 ikke x≈10.9)

### JavaScript-lag
- ✅ `python-files.js` — eneste kilde til `PYTHON_FILES`-listen (var spredt over tre steder)
- ✅ `cas-engine.js` — `onProgress`-callback, `_ready`-flag, JS-fejl re-kastes i stedet for at sluges stille
- ✅ `main.js` — `cas-engine_old.js`-bug rettet, motor-crash adskilt fra celle-fejl i UI
- ✅ `renderer.js` — fejlindenteringsbug rettet, hjælpefunktioner rykket ud af `renderResult`
- ✅ `settings.js` — observer-API (`set` + `onChange` + `reset`), `localStorage`-fejl fanges stille
- ✅ `test-e2e.html` — bruger nu `CASEngine.init()` med `onProgress` i stedet for egen Pyodide-kopi
- ✅ Settings → Engine kobling: `settings.onChange('angleMode', mode => engine.setAngleMode(mode))`

---

## 🔧 FASE 2: SANDSYNLIGHED & HYPOTESETEST (I GANG)

**Tidshorisont:** Maj–Jun 2026

### Sandsynlighedsfordelinger — Python-implementering ✅ FÆRDIG
Disse er implementeret i `distributions.py` og registreret i `registry.py`:
- ✅ `binompdf(k; n; p)`, `binomcdf(k; n; p)` — binomial
- ✅ `poissonpdf(k; λ)`, `poissoncdf(k; λ)` — Poisson
- ✅ `normpdf(x; μ; σ)`, `normcdf(x; μ; σ)`, `invnorm(p; μ; σ)` — normal
- ✅ Momentfunktioner: `mean_B`, `var_B`, `std_B`, `mean_Po`, `var_Po`, `std_Po`, `mean_N`, `var_N`, `std_N`

### Sandsynlighedsfordelinger — mangler stadig
- [ ] Grammatik: tilføj `binompdf`, `normcdf`, `invnorm` osv. til `Grammatik.pegjs` (parser kender dem ikke endnu)
- [ ] Resulttype: `distributions.py` returnerer Python-floats — `result.py` skal pakke dem korrekt i `{ type, latex, decimal }`
- [ ] Tests: E2E-tests for alle fordelingsfunktioner

### Hypotesetest — Python-implementering
Skal implementeres uden SciPy (se nedenfor om SciPy-beslutning):
- [ ] `binomtest(x; n; p0)` — binomialtest, H₀: p = p₀
- [ ] `ttest1(data; μ₀)` — en-stikprøve t-test, H₀: μ = μ₀
- [ ] `ttest2(data1; data2)` — to-stikprøve t-test, H₀: μ₁ = μ₂

Returformat for alle tests:
```json
{
  "type":       "hypothesis_test",
  "test_name":  "Binomialtest",
  "statistic":  2.34,
  "p_value":    0.032,
  "alpha":      0.05,
  "conclusion": "Forkast H₀ (p = 0,032 < α = 0,05)",
  "latex":      "p\\text{-værdi} = 0{,}032"
}
```
- [ ] `result.py` håndterer `hypothesis_test`-typen
- [ ] `renderer.js` renderer `hypothesis_test`-output (struktureret tabel, ikke bare LaTeX)
- [ ] E2E-tests

### SciPy-beslutning (udsat — se backlog)
Den ursprunglige plan var at bruge `scipy.stats` til hypotesetest og regression. Det udsættes fordi:
- SciPy tilføjer ~30 sekunder til opstartstiden i Pyodide
- Ren Python-implementering er tilstrækkelig nøjagtig til STX/HF-niveau
- Beslutningen genovervejes til Fase 3 når/hvis vi har brug for mere avancerede tests

---

## 📋 FASE 3: VISUALISERING MED PLOTLY (NÆSTE STORE FEATURE)

**Tidshorisont:** Jul–Aug 2026 — *efter* Web Worker er på plads

*Plotly er det feature der vil have størst pædagogisk effekt og er efterspurgt af elever.*
*Men det bygger på en forudsætning: UI-tråden må ikke fryse under beregning.*
*Derfor: Web Worker (Fase 5 i original plan) implementeres INDEN Plotly.*

### Arkitektur
Python genererer datapunkter som JSON. Plotly renderer i browseren.
Separationen er ren: Python ved intet om Plotly, Plotly ved intet om SymPy.

```
engine.calculate("graphplot(f; 0; 10)")
    → Python: { type: "plot", data: [{x: [...], y: [...]}], layout: {...} }
    → JS: Plotly.newPlot(container, data, layout)
```

### Funktioner der implementeres
- [ ] `graphplot(f; a; b)` — funktionsplot
- [ ] `graphplot({f; g}; a; b)` — flere funktioner i samme koordinatsystem
- [ ] `xyplot(x_data; y_data)` — punktplot
- [ ] `xyplot(x_data; y_data; f)` — punktplot med regressionskurve
- [ ] `histogram(data)` / `histogram(data; k)` — histogram med valgfrit klasseantal
- [ ] `boxplot(data)` — boksplot
- [ ] `sumcurve(data)` — kumulativ frekvenskurve

### Celletypen "grafik"
- [ ] Ny celletype i notebook-strukturen: `type: 'plot'`
- [ ] Plotly-output er reaktivt: ændres en afhængig variabel, opdateres grafen automatisk
- [ ] Print-CSS: grafer eksporteres som vektorgrafik i PDF

---

## 📋 FASE 4: AVANCERET MATEMATIK

**Tidshorisont:** Sep–Okt 2026

### Lineær Algebra
- [ ] Vektor-operationer: `dotP(u; v)`, `crossP(u; v)`, `norm(v)`, `angle(u; v)`
- [ ] Matrix-operationer: `det(M)`, `inv(M)`, `rank(M)`
- [ ] Egenværdier: `eigenvalues(M)`, `eigenvectors(M)`

### Differentialligninger
- [ ] `dsolve(ligning; funktion)` — symbolsk løsning via SymPy
- [ ] `odeint(f; y0; t_vals)` — numerisk løsning (kræver SciPy eller simpel Euler/RK4)

### Optimering
- [ ] `minimize(f; x)` / `maximize(f; x)` — find ekstrema
- [ ] `fsolve(f; x0)` — numerisk ligningsløsning (Newton-Raphson)

---

## 📋 FASE 5: UI & NOTEBOOK-STRUKTUR

**Tidshorisont:** Nov 2026 og frem

### Celletyper
- [ ] Tekstblokke med Markdown og inline `$...$`-matematik
- [ ] Datablokke — tabeleditor til statistikdata
- [ ] Grafik-blokke (hænger sammen med Fase 3)

### Dokument & persistens
- [ ] `.ncas`-filformat (JSON) med `Ctrl+S` og `Ctrl+O`
- [ ] `localStorage`-autosave ved hver ændring
- [ ] Drag-and-drop import af `.ncas`-filer
- [ ] Elev-profil (`.ncas-profile`) til maskinskift

### Eksamen
- [ ] Eksamenshoved (navn, skole, klasse) — kun synligt ved print
- [ ] Print-CSS med korrekt paginering og KaTeX i PDF

---

## 🐛 TEKNISK BACKLOG (DEFERRED — med prioritet)

### P1 — Bør løses inden Fase 3

**Domænefejlklassificering via fejlkoder, ikke regex (P1)**
*Identificeret: Maj 2026*
`error-catalog.js` bruger regex på den genererede Python-kode til at genkende domænefejl (`sqrt(-4)`, `log(-1)` osv.). Det er skrøbeligt — ændres transformerens output, bryder fejlbeskeder stille.
Løsning: Python rapporterer specifikke koder (`DOMAIN_SQRT_NEGATIVE`, `DOMAIN_LOG_NEGATIVE` osv.) direkte i fejlobjektet. JS-siden oversætter kode → tekst uden regex.

**Web Worker til Pyodide (P1)**
*Identificeret: Apr 2026, forudsætning for Fase 3*
Pyodide kører på UI-tråden. Tunge beregninger (regression på store datasæt, `dsolve`, Plotly-data) fryser browseren. Skal flyttes til dedikeret Worker inden grafik-implementeringen.
Kommunikationsprotokol er designet (se `Arkitektur_og_dataflow.md`, afsnit 5).

### P2 — Vigtigt, men ikke blokerende

**Symboler med reelt domæne som standard (P2)**
*Identificeret: Apr 2026*
`Symbol('x')` i SymPy antager komplekst domæne som standard, hvilket giver mærkelige simplifikationer (fx `sqrt(x²) = |x|` ikke `x`). `Symbol('x', real=True)` giver matematisk korrekt adfærd for gymnasieniveau.
Kobles til `settings.engine.defaultDomain`.

**Variable shadowing-advarsel (P2)**
*Identificeret: Apr 2026*
`f(x) := x²` efterfulgt af `x := 5` gør at `f(3)` returnerer 25 ikke 9.
Løsning: `executor.py` inspicerer task-scope efter assignments og returnerer et `warning`-felt hvis en ny variabel skygger for en funktionsparameter.

**Transformer: `translate` → privat, `UNIT_ALIASES`/`OPS` → static (P2)**
*Identificeret: Maj 2026*
`translate()` er den rekursive interne funktion men er public. `UNIT_ALIASES` og `OPS` er modul-globals der er implementationsdetaljer for klassen. Ingen funktionel konsekvens nu, men skaber forvirring efterhånden som transformer vokser.

### P3 — Kan vente

**Timeout-mekanisme (P3)**
`settings.engine` definerer ingen `timeout` (fjernet bevidst — se Fase 1B). Når Web Worker implementeres, tilføjes timeout som `Promise.race` mod Worker-kaldet. Defineres ikke i settings før da.

**`addNewCell` → `notebook.js` (P3)**
*Identificeret: Maj 2026*
Celle-fabrikken i `main.js` hører hjemme i et dedikeret `notebook.js`-modul efterhånden som celletyper vokser (tekst, grafik, data). Ikke presserende endnu.

**Service Worker & offline-caching (P3)**
Pyodide og SymPy (>50 MB) indlæses ved hvert besøg. En Service Worker der cacher dem lokalt reducerer opstartstid fra ~30s til <2s ved genbesøg. Implementeres som et isoleret lag der ikke påvirker resten af arkitekturen.

---

## 📊 PROJEKT-METRIKER

| Metrik | Status |
|--------|--------|
| **E2E-tests** | 120/120 ✅ |
| **Parser** | Stabil ✅ |
| **Transformer** | Stabil ✅ |
| **Python Engine** | Stabil ✅ |
| **cas_math-arkitektur** | Ren & modulariseret ✅ |
| **JS-arkitektur** | Ren, observer-koblet ✅ |
| **Enhedssystem** | Fungerende ✅ |
| **Regression** | Fungerende ✅ |
| **Fordelinger** | Python klar, parser/UI mangler 🔧 |
| **Fejlhåndtering** | Dansk output, regex-klassif. bør migreres 🔧 |
| **Performance** | <500ms per eval, UI-tråd blokerer ved tunge kald ⚠️ |

---

## 🎯 ANBEFALET RÆKKEFØLGE FOR NÆSTE SESSION

### Hvad der IKKE anbefales som næste skridt — og hvorfor

**Plotly nu?** Nej. Plotly kræver tunge Python-beregninger (datapunkter til grafer). Uden Web Worker fryser UI ved enhver grafgenerering. Det giver en dårlig oplevelse og vil føre til en masse workarounds. Plotly fortjener et solidt fundament.

**Differentialligninger nu?** Nej. De hører til Fase 4 og afhænger af enten SciPy (`odeint`) eller en hjemmebrygget numerisk løser. Mere matematik-kompleksitet ovenpå arkitektur der ikke er klar til tunge beregninger er ikke strategisk.

### Hvad der anbefales: Fase 2 i mål, så Web Worker

**Næste session (1-2 dage): Fase 2 færdiggøres**

Distributionerne er klar på Python-siden. Det der mangler er relativt afgrænset:

1. **`Grammatik.pegjs`**: tilføj `binompdf`, `binomcdf`, `normcdf`, `invnorm`, `poissonpdf` som kendte funktionsnavne. Parser-ændringen er minimal — de kalder alle bare `FunctionCall`-noden.

2. **`result.py`**: floats fra fordelingsfunktioner pakkes allerede korrekt. Tjek at `hypothesis_test`-typen er planlagt for hypotesetest-output.

3. **Hypotesetest**: `binomtest` og `ttest1` i ren Python (t-fordelingens CDF kan approksimeres ligesom normalfordelingens — samme Newton-Raphson-mønster som `invnorm`). Chi²-testen er lidt mere arbejde men også selvstændig.

4. **Tests**: Udvid `test-e2e.html` med en fordelingssektion (~20 tests).

**Sessionen efter: Web Worker**

Web Worker er arkitektonisk isoleret — det er udelukkende en ændring i `cas-engine.js` og `python-files.js`. Resten af koden rører det ikke. Med Worker på plads er vejen til Plotly åben.

---

## 🎓 EKSAMEN-READINESS

**Nuværende tilstand:** MVE+ (Minimum Viable Education plus arkitekturstabilitet)
- Grundlæggende STX/HF-matematik dækket
- Dansk notation & fejlbeskeder ✅
- Offline-first (serverless) ✅
- Ren, vedligeholdbar kodebase ✅

**Hvad der mangler før bred launch:**
- Sandsynlighedsfordelinger tilgængelige i UI (Fase 2)
- Hypotesetest (Fase 2)
- Grafik (Fase 3) — det feature eleverne spørger mest til

---

*Rev. 100526 · Erstatter: `roadmap.md (Rev. 120426)`*
*Vedligeholder: Jakob (Holstebro Gymnasium)*
