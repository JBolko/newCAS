# newCAS - Aktuelt funktionskatalog

**Autoritativ kilde for newCAS-funktionerne:** `src/python/cas_math/registry.py`.

Snapshot: september 2026.

Dette dokument beskriver de funktioner, som newCAS selv eksponerer via `cas_math/registry.py`.
De almindelige SymPy-funktioner, som også findes i runtime-contexten, er en separat kategori og er ikke en del af dette register.

## 1. Registrerede funktioner

Der er aktuelt **35 registrerede funktioner**.

### Calculus

| Funktion | Bruger-syntaks | Betydning |
|---|---|---|
| `diff` | `diff(f; x)` / `diff(f; x; n)` | 1. eller n'te afledede |
| `integrate` | `integrate(f; x)` / `integrate(f; x; a; b)` | Ubestemt eller bestemt integral |
| `limit` | `limit(f; x; a)` / `limit(f; x; a; højre/venstre)` | Grænseværdi, evt. ensidig |
| `arclength` | `arclength(f; x; a; b)` | Kurvelængde |

`integrate` er registreret som `calculus.integrate_cas`; navnet brugeren skriver er altså `integrate`.

### Statistik

| Funktion | Bruger-syntaks | Betydning |
|---|---|---|
| `mean` | `mean(data)` | Aritmetisk middelværdi |
| `median` | `median(data)` | Median |
| `Q1` | `Q1(data)` | Nedre kvartil |
| `Q3` | `Q3(data)` | Øvre kvartil |
| `min` | `min(data)` eller `min(a; b; ...)` | Minimum |
| `max` | `max(data)` eller `max(a; b; ...)` | Maksimum |

### Regression

| Funktion | Bruger-syntaks | Model |
|---|---|---|
| `linReg` | `linReg(x; y)` | `y = a·x + b` |
| `expReg` | `expReg(x; y)` | `y = a·e^(b·x)` |
| `powReg` | `powReg(x; y)` | `y = a·x^b` |
| `logReg` | `logReg(x; y)` | `y = a + b·ln(x)` |

`linReg`, `expReg`, `powReg` og `logReg` returnerer strukturerede `regression`-resultater med koefficienterne i `params` samt `r_squared`.

### Binomialfordeling

Her er parameterordenen **`(k, n, p)`**.

| Funktion | Bruger-syntaks | Betydning |
|---|---|---|
| `binompdf` | `binompdf(k; n; p)` | `P(X = k)` for `X ~ B(n,p)` |
| `binomcdf` | `binomcdf(k; n; p)` | `P(X ≤ k)` for `X ~ B(n,p)` |
| `mean_B` | `mean_B(n; p)` | `E(X) = n·p` |
| `var_B` | `var_B(n; p)` | `Var(X) = n·p·(1-p)` |
| `std_B` | `std_B(n; p)` | Standardafvigelse |

### Hypotesetest

| Funktion | Bruger-syntaks | Betydning |
|---|---|---|
| `binomtest` | `binomtest(x; n; p0)` + evt. `less`, `greater` og/eller `alpha` | Binomialtest for `H₀: p = p0` |
| `chi2gof` | `chi2gof(observed; expected)` + evt. `alpha` | Chi² goodness-of-fit-test |
| `chi2ind` | `chi2ind(række1; række2; ...)` + evt. `alpha` | Chi²-uafhængighedstest |
| `ttest1` | `ttest1(data; mu0)` + evt. `less`, `greater` og/eller `alpha` | En-stikprøve t-test |
| `ttest2` | `ttest2(data1; data2)` + evt. `less`, `greater` og/eller `alpha` | Welch to-stikprøve t-test |

Hypotesetest returnerer `type: "hypothesis_test"` og et struktureret resultat, som renderer-laget viser særskilt.

Standardniveauet er `alpha = 0,05`, medmindre andet angives.

### Poissonfordeling

| Funktion | Bruger-syntaks | Betydning |
|---|---|---|
| `poissonpdf` | `poissonpdf(k; λ)` | `P(X = k)` for `X ~ Po(λ)` |
| `poissoncdf` | `poissoncdf(k; λ)` | `P(X ≤ k)` for `X ~ Po(λ)` |
| `mean_Po` | `mean_Po(λ)` | `E(X) = λ` |
| `var_Po` | `var_Po(λ)` | `Var(X) = λ` |
| `std_Po` | `std_Po(λ)` | `√λ` |

### Normalfordeling

| Funktion | Bruger-syntaks | Betydning |
|---|---|---|
| `normpdf` | `normpdf(x; μ; σ)` | Tæthed `f(x)` for `X ~ N(μ, σ²)` |
| `normcdf` | `normcdf(x; μ; σ)` | `P(X ≤ x)` |
| `invnorm` | `invnorm(p; μ; σ)` | Finder `x` så `P(X ≤ x) = p` |
| `mean_N` | `mean_N(μ; σ)` | `E(X) = μ` |
| `var_N` | `var_N(μ; σ)` | `Var(X) = σ²` |
| `std_N` | `std_N(μ; σ)` | `σ` |

## 2. Eksempler i newCAS-syntaks

```text
2 + 3

mean({1; 2; 3; 4; 5})

linReg({1; 2; 3}; {3; 5; 7})

binompdf(2; 10; 0,5)
binomcdf(2; 10; 0,5)

poissonpdf(3; 2)
poissoncdf(3; 2)

normcdf(1,96; 0; 1)
invnorm(0,84; 0; 1)

binomtest(7; 10; 0,5)
ttest1({1; 2; 3; 4; 5}; 3)
```

## 3. Parseren kender ikke funktionslisten

De registrerede funktioner kræver ikke hver deres grammar-regel.

Parseren bruger den generiske regel:

```pegjs
FunctionCall
  = id:Identifier "(" _ args:Args _ ")"
```

F.eks. parses `binompdf(2; 10; 0,5)` som en `FunctionCall` med `name = "binompdf"`.

Det er `registry.py` og runtime-contexten, der afgør, om navnet faktisk kan kaldes.

**Konsekvens:** En ny newCAS-funktion skal normalt implementeres, registreres og testes, men kræver ikke en ændring i `Grammatik.pegjs`.

## 4. Funktioner fra SymPy-contexten

Runtime-contexten starter med SymPy's callable navne og lægger derefter newCAS-registret ovenpå. Det betyder, at funktioner som f.eks. `sqrt`, `log`, `exp` og `solve` også er tilgængelige i runtime.

De er **ikke** registreret i `cas_math/registry.py` og er derfor ikke med i de 35 newCAS-funktioner ovenfor.

Dette skel er vigtigt i dokumentationen:

```text
newCAS-funktioner = cas_math/registry.py
SymPy-funktioner  = runtime-context fra SymPy
```

`solve`, som nævnes som implementeret i ældre roadmap-dokumentation, hører til den sidste kategori i den aktuelle kode.

## 5. Kode og test

Implementationen ligger i:

- `src/python/cas_math/calculus.py`
- `src/python/cas_math/statistics.py`
- `src/python/cas_math/distributions.py`

Registreringen ligger i:

- `src/python/cas_math/registry.py`

De aktuelle kontrakttests findes i:

- `src/python/tests/test_contracts.py`
- `src/python/tests/test_cas.py`

## 6. Dokumentationsregel

Når en ny **newCAS-funktion** tilføjes:

1. implementér den i det relevante `cas_math`-modul,
2. registrér det offentlige navn i `registry.py`,
3. tilføj test,
4. opdater dette funktionskatalog.

Grammatikken ændres kun, hvis selve syntaksen ændres.
