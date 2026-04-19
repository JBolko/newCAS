# Funktionskatalog — newCAS
*Rev. 120426*

---

## Konventioner

**Syntaks:** Argumenter adskilles med semikolon: `f(a; b; c)`. Komma bruges kun som decimaltegn.

**Status-ikoner:**
- ✅ Implementeret og testbekræftet
- 🔧 Implementeret, kræver yderligere tests
- 📋 Planlagt (se roadmap for fase)

**Returformat:** Alle funktioner returnerer et JSON-objekt med mindst `type` og `latex`. Se `Arkitektur_og_dataflow.md` afsnit 4.3 for det fulde format.

---

## 1. Algebra og ligninger

### Grundlæggende ✅
```
simplify(expr)              → forenkler udtryk
expand(expr)                → folder parenteser ud
factor(expr)                → faktoriserer
```

### Ligninger ✅
```
solve(eq; var)              → løser ligning mht. variabel
                              solve(2x + 3 = 7; x) → {2}
solve(eq; var; domain)      → med domænebegrænsning (planlagt)
```

### Ligningssystemer 📋
```
solve({eq1; eq2}; {x; y})   → løser system af ligninger
```

### Øvrige algebra 📋
```
completesquare(expr; var)   → fuldstændig kvadratsætning: x^2+4x+3 → (x+2)^2-1
isolate(expr; var)          → isoler variabel uden at løse numerisk
partial_fractions(expr; var) → partialbrøksopspaltning
```

---

## 2. Infinitesimalregning

### Differentialregning ✅
```
diff(f; x)                  → f'(x), første afledte
diff(f; x; n)               → n'te afledte
```

Planlagt notation-sukker:
```
f'(x)                       → diff(f(x); x)
f''(x)                      → diff(f(x); x; 2)
```

### Integralregning ✅
```
integrate(f; x)             → ubestemt integral ∫f dx
integrate(f; x; a; b)       → bestemt integral ∫[a,b] f dx
```

### Øvrig analyse 📋
```
limit(f; x; a)              → grænseværdi lim(x→a) f(x)
limit(f; x; a; '+')         → grænseværdi fra højre
arclength(f; x; a; b)       → kurvelængde ∫√(1+f'²) dx
```

---

## 3. Trigonometri ✅

Alle trigonometriske funktioner respekterer `settings.angleMode` (`'deg'` eller `'rad'`).

```
sin(x)   cos(x)   tan(x)   → sinus, cosinus, tangens
sec(x)   csc(x)   cot(x)   → sekant, cosekant, cotangens
asin(x)  acos(x)  atan(x)  → inverse: returnerer vinkel i aktuel mode
```

---

## 4. Statistik — deskriptiv ✅

Input er altid en liste: `{x1; x2; x3; ...}`

```
mean(data)                  → middelværdi (aritmetisk)
median(data)                → median
Q1(data)                    → nedre kvartil
Q3(data)                    → øvre kvartil
min(data)                   → minimum
max(data)                   → maksimum
```

Planlagt 📋:
```
variance(data)              → varians (populationsvarians)
sd(data)                    → standardafvigelse
IQR(data)                   → interkvartilbredde Q3 - Q1
quartiles(data)             → {Q0; Q1; Q2; Q3; Q4} samlet
frequencyTable(data)        → frekvenstabel med abs., rel. og kumulativ frekvens
```

---

## 5. Sandsynlighedsfordelinger 📋

Alle fordelinger implementeres via `scipy.stats`.

### Binomialfordeling
```
binompdf(n; p; x)           → P(X = x) for X ~ B(n,p)
binomcdf(n; p; a; b)        → P(a ≤ X ≤ b)
binominv(n; p; alpha)       → mindste k så P(X ≤ k) ≥ alpha
```

Planlagt syntaktisk sukker:
```
X ~ b(n; p)                 → definerer stokastisk variabel X ~ B(n,p)
P(X = k)                    → binompdf med X's parametre
P(a <= X <= b)              → binomcdf med korrekte grænser
```

### Normalfordeling
```
normalcdf(mu; sigma; a; b)  → P(a ≤ X ≤ b) for X ~ N(μ,σ)
normpdf(mu; sigma; x)       → tæthedsfunktionsværdi f(x)
norminv(mu; sigma; p)       → invers: x så P(X ≤ x) = p
```

### Poissonfordeling 📋
```
poissonpdf(lambda; x)       → P(X = x) for X ~ Po(λ)
poissoncdf(lambda; a; b)    → P(a ≤ X ≤ b)
```

---

## 6. Hypotesetest 📋

Alle tests returnerer et struktureret objekt med teststatistik, p-værdi og konklusion.

```
binomtest(x; n; p0)         → binomialtest: H0: p = p0
binomtest(x; n; p0; 'less') → ensidet test (less / greater / two-sided)

ttest(data; mu0)            → en-stikprøve t-test: H0: μ = μ0
ttest2(data1; data2)        → to-stikprøve t-test: H0: μ1 = μ2

chi2GOF(observed; expected) → goodness-of-fit test
chi2Independence(matrix)    → uafhængighedstest (kontingenstabel som matrix)
```

Returformat:
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

---

## 7. Regression 📋

Alle regressionsfunktioner implementeres via `scipy.optimize.curve_fit` og `numpy.polyfit`.

```
linReg(x_data; y_data)          → lineær: y = ax + b
expReg(x_data; y_data)          → eksponentiel: y = a · eˢˣ
powReg(x_data; y_data)          → potensfunktion: y = a · xᵇ
logReg(x_data; y_data)          → logaritmisk: y = a · ln(x) + b
logisticReg(x_data; y_data)     → logistisk: y = c / (1 + a · e^(−bx))
```

Returformat:
```json
{
  "type": "regression",
  "model": "linear",
  "latex": "y = 2{,}3x + 1{,}7",
  "coefficients": { "a": 2.3, "b": 1.7 },
  "r_squared": 0.987
}
```

Resultatet kan tildeles en funktion: `f := linReg(x; y)` — derefter kan `f(5)` evalueres.

---

## 8. Vektorer og lineær algebra 📋

Vektorer parses allerede som `[x; y; z]` og transformeres til SymPy `Matrix`. Det der mangler er de tilhørende operationer:

```
dotP(u; v)                  → prikprodukt u · v
crossP(u; v)                → vektorprodukt u × v (kun 3D)
norm(v)                     → vektorlængde |v|
angle(u; v)                 → vinkel mellem vektorer (respekterer angleMode)
det(M)                      → determinant
inv(M)                      → invers matrix
```

---

## 9. Enheder og konvertering ✅

Tal med enheder angives i kantede parenteser: `9,82[m/s^2]`. Konvertering med `->`:

```
5[m] -> [cm]                → 500 cm
36[km/h] -> [m/s]           → 10 m/s
1[bar] -> [Pa]              → 100000 Pa
```

#### Understøttede enheder

| Kategori | Enheder |
| :--- | :--- |
| Tid | `s`, `ms`, `min`, `h` |
| Længde | `m`, `mm`, `cm`, `dm`, `km` |
| Masse | `g`, `mg`, `kg` |
| Kraft/Energi/Effekt | `N`, `J`, `kJ`, `MJ`, `W`, `kW`, `kWh` |
| Tryk | `Pa`, `hPa`, `bar` |
| El | `A`, `mA`, `V`, `kV`, `C`, `Ohm` |
| Temperatur | `K`, `degC` (absolut), `deltaC` (forskel) |

---

## 10. Grafer og visualisering 📋

Plotly.js er valgt som grafbibliotek. Python-motoren genererer datapunkter som JSON — Plotly renderer dem i browseren.

```
graphplot(f; interval)          → funktionsplot over interval [a; b]
graphplot({f; g}; interval)     → flere funktioner i samme koordinatsystem
xyplot(x_data; y_data)          → punktplot
xyplot(x_data; y_data; f)       → punktplot med regressionskurve
boxplot(data)                   → boksplot
histogram(data)                 → histogram
histogram(data; k)              → histogram med k klasser
sumcurve(data)                  → kumulativ frekvenskurve
```

---

*Rev. 120426 · Dette dokument erstatter ikke andre dokumenter*
