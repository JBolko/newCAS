# newCAS - JSON-kontrakter

Dette dokument er den autoritative beskrivelse af JSON-data, der passerer mellem newCAS-lagene.

Grundregel:

```text
AST:
    parser -> AST -> transformer

CAS-resultat:
    Python runtime -> output/result.py -> JSON -> renderer/UI
```

`type` er den primære discriminator. Modtageren skal altid se på `type` før andre felter.

## 1. AST-kontrakt

Parseren returnerer et JavaScript-objekt, aktuelt normalt et array af statements.

Aktuelle AST-nodetyper:

`Literal`, `Variable`, `BinaryExpression`, `PowerExpression`, `UnaryExpression`,
`FunctionCall`, `Assignment`, `FunctionDefinition`, `Equation`, `List`, `Vector`,
`Quantity`, `Conversion`, `Access`, `Derivative`.

Eksempel:

```json
{
  "type": "FunctionCall",
  "name": "binompdf",
  "args": [
    {"type": "Literal", "value": 2},
    {"type": "Literal", "value": 10},
    {"type": "Literal", "value": 0.5}
  ]
}
```

Parseren ved ikke, om `binompdf` findes. Den parser alle `Identifier(...)`-kald som `FunctionCall`.
Det autoritative funktionskatalog findes i `src/python/cas_math/registry.py`.

## 2. Resultat-discriminator

Aktuelle result-typer:

```text
success
scalar
list
warning
error
hypothesis_test
regression
```

Der må ikke oprettes parallelle navne for disse typer uden en eksplicit API-beslutning.

## 3. `success`

Bruges når et statement er udført, men ikke skal give et beregnet output:

```json
{
  "type": "success"
}
```

## 4. `scalar`

Et enkelt matematisk resultat.

Typisk numerisk eksempel:

```json
{
  "type": "scalar",
  "latex": "0{,}0439453",
  "decimal": "0.0439453125"
}
```

### 4.1 `latex`

`latex` er en streng til præsentation i KaTeX.
Den er ikke den interne matematiske datatype.

### 4.2 `decimal` - vigtig API-præcisering

Navnet `decimal` er historisk og beholdes af hensyn til API-stabilitet.

**`decimal` er en displaystreng. Den er ikke garanteret at indeholde ét numerisk tal.**

Ved numeriske resultater indeholder den typisk en numerisk tekst:

```json
"decimal": "0.0439453125"
```

Ved symbolske resultater kan den indeholde en tekstlig repræsentation af udtrykket:

```json
{
  "type": "scalar",
  "latex": "x^{2} + 1",
  "decimal": "x**2 + 1.0",
  "is_symbolic": true
}
```

Ved komplekse warnings kan den tilsvarende indeholde en kompleks tekstlig repræsentation:

```json
{
  "type": "warning",
  "code": "COMPLEX_RESULT",
  "latex": "3 i",
  "decimal": "3.0*I",
  "source": "sqrt(-9)"
}
```

Derfor må frontend-kode **ikke** generelt antage:

```javascript
parseFloat(result.decimal)
```

og `decimal` skal behandles som tekst.

### 4.3 `is_symbolic`

`is_symbolic: true` bruges på symbolske `scalar`-resultater, når resultatet har frie symboler.

Renderer'en viser ikke `decimal` som numerisk approksimation, når `is_symbolic` er `true`.

## 5. `list`

Lister returneres som:

```json
{
  "type": "list",
  "latex": "1, 2, 3",
  "decimal": "1.00000000000000, 2.00000000000000, 3.00000000000000"
}
```

`decimal` er også her en displaystreng. Den indeholder én repræsentation pr. listeelement og kan derfor ikke fortolkes som ét tal.

For symbolske elementer kan den være tekstlig, fx:

```json
{
  "type": "list",
  "latex": "x, x",
  "decimal": "x, x"
}
```

## 6. `warning`

En `warning` betyder, at motoren har udført beregningen, men at resultatet kræver en særlig præsentation eller domæneforklaring.

Aktuelt eksempel:

```json
{
  "type": "warning",
  "code": "COMPLEX_RESULT",
  "latex": "3 i",
  "decimal": "3.0*I",
  "source": "sqrt(-9)"
}
```

`warning` er derfor ikke det samme som `error`.

`source` er den genererede Python-kode, når frontend'en bruger den til en mere præcis forklaring.

## 7. `error`

En beregning, der ikke kunne gennemføres:

```json
{
  "type": "error",
  "code": "ZERO_DIVISION",
  "message": "Division med nul",
  "raw": "division by zero"
}
```

`code` er maskinlæsbar og er den primære nøgle til frontend-dispatch.

`message` er den strukturerede fejltekst.

`raw` er teknisk debugging-information og må ikke automatisk vises til eleven.

Aktuelle almindelige fejlkoder omfatter:

```text
ZERO_DIVISION
UNDEFINED_NAME
PYTHON_ERROR
```

`COMPLEX_RESULT` produceres i praksis som `warning` af `output/result.py`.

## 8. `hypothesis_test`

Hypotesetest er strukturerede resultater og følger ikke scalar-rendering.

Fælles felter for de kontinuerte tests omfatter bl.a.:

```json
{
  "type": "hypothesis_test",
  "test_name": "T-test (to stikprøver, Welch)",
  "side": "two",
  "side_name": "Tosidet",
  "h0": "μ₁ = μ₂",
  "h1": "μ₁ ≠ μ₂",
  "statistic": 2.14,
  "stat_sym": "t",
  "df": 18.2,
  "p_value": 0.046,
  "p_value_fmt": "0,046",
  "alpha": 0.05,
  "alpha_pct": "5%",
  "reject_h0": true,
  "conclusion": "Forkast H₀"
}
```

`binomtest` har yderligere testspecifikke felter som `x`, `n`, `p0`, `accept`, `accept_str` og `crit_str`.

## 9. `regression`

Regression returnerer et struktureret objekt:

```json
{
  "type": "regression",
  "model": "linReg",
  "params": {
    "a": 2.0,
    "b": 1.0
  },
  "latex": "y = 2x + 1",
  "decimal": "a = 2, b = 1",
  "r_squared": 1.0
}
```

`params` er det autoritative feltnavn for regressionskoefficienterne.

I regression er `decimal` igen en displaystreng - ikke et felt, der skal parses som ét tal.

Renderer'en bruger regressionens `latex` og `r_squared` direkte og følger ikke den generelle scalar-rendering.

## 10. Maskinlæsbare vs. præsentationsfelter

```text
Maskinlæsbare / strukturelle:
    type
    code
    is_symbolic
    params
    p_value
    r_squared
    reject_h0
    ...

Præsentation:
    latex
    decimal
    message
    conclusion
    *_fmt
    side_name
    ...
```

Et felt kan godt være en streng og stadig være en del af API'et. JSON-typen alene afgør ikke, om et felt er beregningsmæssigt eller præsentationsmæssigt.

## 11. Renderer-konsekvens

Den aktuelle renderer bruger den generelle scalar/list-path sådan:

```javascript
if (result.decimal && !result.is_symbolic) {
    const sep = settings?.user?.decimalSeparator ?? ',';
    decimalDiv.textContent = `≈ ${result.decimal.replace('.', sep)}`;
}
```

Det betyder:

- `decimal` forventes som tekst
- `is_symbolic` undertrykker generel decimalvisning
- `hypothesis_test` har sin egen renderer
- `regression` har sin egen renderer
- frontend'en skal dispatch'e på `type` først

## 12. Kontraktregel

Når et JSON-felt først bruges af et andet lag, er det en del af API-kontrakten.

Ændringer i:

- `type`
- feltnavn
- feltets betydning
- obligatorisk/valgfrit

skal ledsages af:

1. ændring i producerende kode
2. kontrakttest
3. opdatering af dette dokument
4. opdatering af modtagende kode, hvis nødvendigt

Der må ikke dokumenteres felter, som den aktuelle kode ikke producerer.
