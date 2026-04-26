# newCAS Roadmap — Status April 2026

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
- ✅ KaTeX-rendering med dansk notation
- ✅ `type: 'scalar'`, `'symbolic'`, `'list'`, `'equation'`, `'regression'`, `'warning'`, `'error'`
- ✅ `latex` felt med TeX-formatering
- ✅ `decimal` felt med numerisk approksimation
- ✅ `source` felt for fejldiagnostik

### Test Suite
- ✅ **120 E2E-tests** (alle bestået)
  - Aritmetik (10 tests)
  - Symbolsk matematik (8 tests)
  - Scope & persistens (4 tests)
  - Funktioner & Lambda (5 tests)
  - Solve (3 tests)
  - Statistik (7 tests)
  - Enheder & konvertering (7 tests)
  - Trigonometri deg/rad (12 tests)
  - Differentialregning (7 tests)
  - Integralregning (10 tests)
  - Analyse/Limit (6 tests)
  - Kurvelængde (4 tests)
  - Afledede via apostrof (10 tests)
  - Grænseværdier (6 tests)
  - Regression (6 tests)

---

## 🔮 FASE 2: VIDERE STATISTIK & SANDSYNLIGHED (PLANLAGT)

**Tidshorisont:** Maj–Jun 2026

### Regressionsudvidelse
- [ ] `linearReg` med residual-plot
- [ ] `polynomialReg(data, degree)` — polynom-fitting
- [ ] Goodness-of-fit test (χ²)

### Sandsynlighedsfordelinger
- [ ] `binompdf(n; k; p)` — binomial-sandsynlighed
- [ ] `binomcdf(n; k; p)` — binomial kumulativ
- [ ] `normalcdf(x; μ; σ)` — normalfordeling
- [ ] `poissonpdf(λ; k)` — Poisson-fordeling

### Hypotesetest
- [ ] `binomtest(obs; n; p)` — binomial test
- [ ] `chi2GOF(obs; exp)` — goodness-of-fit
- [ ] `ttest(data1; data2)` — uparret t-test

### Grafik (evt. sekundær prioritet)
- [ ] `plot(f; x; a; b)` — funktionsgraf (SVG eller Canvas)
- [ ] `scatterplot(x_data; y_data)` — datapunkter
- [ ] `histogram(data; bins)` — hyppighedsfordeling

---

## 📋 FASE 3: AVANCERET MATEMATIK (SENERE)

**Tidshorisont:** Jul–Aug 2026

### Lineær Algebra
- [ ] Vektor-operationer: `dotP(u; v)`, `crossP(u; v)`
- [ ] Matrix-operationer: `det(M)`, `inv(M)`, `rank(M)`
- [ ] Egenværdier: `eigenvalues(M)`, `eigenvectors(M)`

### Differentialligninger
- [ ] `dsolve(ligning; funktion)` — symbolsk løsning
- [ ] `odeint(f; y0; t_vals)` — numerisk løsning

### Fourieranalyse & Komplekse tal
- [ ] Komplekse operationer: `real(z)`, `imag(z)`, `conjugate(z)`
- [ ] `fft(data)` — Fouriertransform (evt. via NumPy hvis det bliver nødvendigt)

### Optimering
- [ ] `minimize(f; x)` — find minimum
- [ ] `maximize(f; x)` — find maksimum
- [ ] `fsolve(f; x0)` — numerisk ligningsløsning

---

## 🐛 KENDT BACKLOG (DEFERRED)

### Scoping & Variable Shadowing
**Status:** Identificeret men deferred til senere

Problem: Hvis elev gør `f(x) := x²` og derefter `x = 5`, bliver senere kald til `f(...)` påvirket.

**Løsning planlagt:** UI-advarsel når assignment overstyrer funktion-parameter.
- Implementeres ved at inspicere task-scope efter hver assignment
- Viser gul advarsel: *"Advarsel: x er parameter i funktion f. Senere kald vil bruge værdien 5"*

**Prioritet:** Lav (P3) — god UX men ikke kritisk for funktionalitet

### Symboler med reelt domæne (P2)
**Status:** `Symbol('x', real=True)` som default
- Del af `settings.engine.defaultDomain`
- Påvirker simplificering af √ osv.

### Proaktiv domænevalidering (P2)
**Status:** Wrapper-funktioner med eksplicit domænetjek
- Renere end regex-fejlklassificering
- Fase 1-afslutning når regression stabiliseres

### Service Worker & Caching (P3)
- [ ] Service Worker for offline-funktionalitet
- [ ] Cache Pyodide & SymPy lokalt efter første load

### Web Worker for Pyodide (P2)
- [ ] Flyt Pyodide til dedikeret Web Worker
- [ ] Forhindrer UI-blocking under lange beregninger

---

## 📊 PROJEKT-METRIKER

| Metrik | Status |
|--------|--------|
| **Test Coverage** | 120/120 tests ✅ |
| **Parser Stabilitet** | Stabil ✅ |
| **Transformer Stabilitet** | Stabil ✅ |
| **Python Engine** | Stabil ✅ |
| **Enhedssystem** | Fungerende ✅ |
| **Regression** | Fungerende ✅ |
| **Error Handling** | Dansk output ✅ |
| **Performance** | <500ms per eval ✓ |

---

## 🎓 EKSAMEN-READINESS

**Nuværende tilstand:** MVE (Minimum Viable Education)
- Eleverne kan bruge det til STX/HF-eksamen
- Alle grundlæggende STX-funktioner til stede
- Dansk notation & fejlbeskeder ✅
- Offline (serverless) ✅

**Manglende før SoMe-promo:** Fase 2 statistik (men ikke kritisk for initial launch)

---

## 🚀 NÆSTE SKRIDT

1. **Denne uge:** Deploy til test-gruppe af elever (start maj 2026)
2. **Næste uge:** Samle feedback fra pilot-test
3. **Maj 26:** Implementer Fase 2 baseret på elevernes mest brugte features
4. **Juni 26:** Officiel launch til hele STX-klasse

---

**Sidst opdateret:** 24. april 2026
**Vedligeholder:** Jakob (Holstebro Gymnasium)
