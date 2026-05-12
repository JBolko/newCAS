# Arkitektur og dataflow — newCAS
*Rev. 120426 · Erstatter: `Arkitektur_og_dataflow.md`, `architecture.md`*

---

## 1. Designmål

Arkitekturen er bygget over fire principper:

- **Klar ansvarsdeling.** Hvert lag har ét ansvar. UI ved intet om Python. Python ved intet om UI. Transformeren ved intet om SymPy's interne API.
- **Udvidelsesmuligheder.** Nye matematiske funktioner tilføjes i `setup.py` og `Funktionskatalog`. Ny grammatik tilføjes i `Grammatik.pegjs`. Ingen af delene kræver ændringer i andre lag.
- **Testbarhed.** Hvert lag kan testes isoleret: parseren med `test-parser.html`, transformeren med `test-transformer.html`, og hele kæden med `test-e2e.html`.
- **Offline-first.** Ingen netværkskald under beregning. Alt sker lokalt.

---

## 2. Pipeline-overblik

Brugerens input gennemløber fem trin fra rå tekst til rendered output:

```
Brugerinput (tekst)
      │
      ▼
┌─────────────────┐
│   Parser        │  grammatik.pegjs → parser.mjs
│   (Peggy/PEG)   │  Validerer syntaks, bygger AST
└────────┬────────┘
         │  AST (JSON)
         ▼
┌─────────────────┐
│  Transformer    │  transformer.js
│  (AST → Python) │  Rekursiv AST-traversal → Python-streng
└────────┬────────┘
         │  Python-kode (streng)
         ▼
┌─────────────────┐
│  CAS-motor      │  setup.py + cas-engine.js
│  (Pyodide/SymPy)│  run_in_task() → wrap_result() → JSON
└────────┬────────┘
         │  JSON-resultatobjekt
         ▼
┌─────────────────┐
│  UI             │  main.js + KaTeX
│  (Præsentation) │  Renderer LaTeX, viser decimal
└─────────────────┘
```

Data flyder nedad. Resultater flyder opad. Ingen lag kalder "op" i hierarkiet.

---

## 3. Filstruktur

```
newCAS/
├── index.html                    # Applikationens indgang
├── package.json                  # npm-metadata + build-scripts
│
├── src/
│   ├── js/
│   │   ├── parser.mjs            # Genereret af Peggy (rør ikke denne manuelt)
│   │   ├── transformer.js        # AST → Python-streng
│   │   ├── cas-engine.js         # Pyodide-initialisering og calculate()
│   │   ├── settings.js           # localStorage-baseret settings
│   │   └── main.js               # UI-logik og event handling
│   ├── python/
│   │   └── setup.py              # Python-miljø: wrap_result, run_in_task, enheder
│   └── css/
│       ├── style.css
│       └── components.css
│
├── docs/
│   ├── Grammatik.pegjs           # Kilden til parser.mjs — EDIT HER
│   └── Styredokumenter/
│       ├── roadmap.md
│       ├── Formål.md
│       ├── Arkitektur_og_dataflow.md   ← dette dokument
│       ├── Funktionskatalog.md
│       ├── Bruger_interface_og_interaktionsdesign.md
│       └── DESIGN_LOG.md
│
├── lib/
│   └── katex/                    # KaTeX bundlet lokalt (offline-support)
│
└── test/
    ├── test-parser.html          # Parser-tests (kræver Live Server)
    ├── test-transformer.html     # Transformer-tests
    └── test-e2e.html             # End-to-end tests (kræver Pyodide)
```

**Vigtig regel:** `parser.mjs` er en genereret fil. Den må aldrig redigeres manuelt. Kilde er `docs/Grammatik.pegjs`. Regenerér med `npm run build:parser`.

---

## 4. Lag-for-lag beskrivelse

### 4.1 Parser (`parser.mjs`)

Implementeret med **Peggy** (PEG-parser generator). PEG-parsere er deterministiske — ingen ambiguitet, ingen runtime-fejl af typen "hvad mente brugeren her?". Grammatikken er specificeret i `docs/Grammatik.pegjs`.

Parseren håndterer dansk matematiknotation:
- Komma som decimaltegn: `3,14` → `Literal(3.14)`
- Semikolon som argument-separator: `f(1,5 ; 2,3)` → to argumenter
- Implicit multiplikation med mellemrum: `a b` → `a * b`
- Lange variabelnavne: `hastighed`, `v_0`, `afstand` er alle gyldige identifiers
- Enhedsnotation: `9,82[m/s^2]` → `Quantity(9.82, "m/s^2")`
- Konvertering: `36[km/h] -> [m/s]` → `Conversion(expr, "m/s")`

Output er et **Abstract Syntax Tree (AST)** som et rent JavaScript-objekt.

#### Alle AST-nodetyper

| Nodetype | Eksempel input | Beskrivelse |
| :--- | :--- | :--- |
| `Literal` | `42`, `3,14` | Numerisk konstant |
| `Variable` | `x`, `hastighed` | Identifikator |
| `BinaryExpression` | `a + b`, `x * y` | Binær operator: `+`, `-`, `*`, `/` |
| `PowerExpression` | `x^2` | Potens (højreassociativ) |
| `UnaryExpression` | `-x` | Unært minus |
| `FunctionCall` | `sin(x)`, `solve(eq; x)` | Funktionskald med argumenter |
| `Assignment` | `g := 9,82` | Variabeltildeling |
| `FunctionDefinition` | `f(x) := x^2 + 1` | Funktionsdefinition |
| `Equation` | `2x + 3 = 7` | Ligning (kan være top-level statement) |
| `List` | `{1; 2; 3}` | Mængde/liste af udtryk |
| `Vector` | `[1; 2; 3]` | Vektor (kolonnevektor) |
| `Quantity` | `5[m]` | Tal med enhed |
| `Conversion` | `v -> [km/h]` | Enhedskonvertering |
| `Access` | `data[0]` | Indeksering af liste/vektor |

### 4.2 Transformer (`transformer.js`)

Rekursiv AST-traversal der mapper hver nodetype til en Python-streng. Fungerer som en simpel compiler. Modtager et `settings`-objekt ved instantiering, så angle-mode og andre indstillinger kan påvirke output.

Centrale transformationer:

| AST | Python-output |
| :--- | :--- |
| `PowerExpression(x, 2)` | `(x ** 2)` |
| `Equation(left, right)` | `Eq(left, right)` |
| `FunctionDefinition(f, [x], body)` | `f = Lambda((x), body)` |
| `Vector([1, 2, 3])` | `Matrix([[1], [2], [3]])` |
| `Quantity(9.82, "m/s^2")` | `(9.82 * m/s**2)` |
| `Conversion(expr, "km/h")` | `convert_to_unit(expr, "km/h")` |
| `sin(30)` med `angleMode='deg'` | `sin(((30) * pi / 180))` |
| `asin(0.5)` med `angleMode='deg'` | `((asin(0.5)) * 180 / pi)` |

### 4.3 CAS-motor (`cas-engine.js` + `setup.py`)

**`cas-engine.js`** initialiserer Pyodide, henter og eksekverer `setup.py`, og eksponerer `calculate(ast, taskId)` til resten af applikationen. `taskId` identificerer den opgaveblok som beregningen tilhører — scopet for variable.

**`setup.py`** er det Python-miljø der køres ved opstart. Det definerer:

- `base_context` — det globale navnerum med SymPy-funktioner, statistikfunktioner, enheder og matematiske konstanter (`pi`, `E`, `I`, `oo`)
- `units_dict` — mapping fra enhedsstrenge til SymPy-enhedsobjekter
- `task_registry` — dict der holder et separat lokalt navnerum per `task_id`
- `run_in_task(task_id, code)` — eksekverer Python-kode i det korrekte scope med auto-symbol-oprettelse ved `NameError`
- `wrap_result(res)` — konverterer SymPy-resultater til JSON med `type`, `latex` og `decimal`-felter
- `convert_to_unit(expr, target_unit_str)` — enhedskonvertering

**Scope-modellen:** Hvert kald til `run_in_task` har adgang til `base_context` (globalt, read-only) plus `task_registry[task_id]` (lokalt, read-write). Variable defineret i opgave A lækker ikke til opgave B. `base_context` ændres aldrig under kørsel.

**Auto-symbol-oprettelse:** Hvis en variabel ikke er defineret i hverken `base_context` eller det lokale scope, oprettes den automatisk som et SymPy-symbol. Derved kan eleven skrive `x^2 + 1` uden først at have defineret `x`. Funktionsnavne og konstanter er beskyttet i `FORBIDDEN_SYMBOLS` og kan ikke auto-symboliseres.

#### Resultatobjektet

Alle beregninger returnerer JSON i dette format:

```json
{
  "type": "scalar",          // "scalar" | "list" | "success" | "error"
  "latex": "\\frac{1}{2}",   // LaTeX-streng til KaTeX
  "decimal": "0.5",          // Altid numerisk streng (aldrig "1/2")
  "is_symbolic": false        // true hvis resultatet indeholder frie symboler
}
```

For fejl:
```json
{ "type": "error", "message": "Division med nul er ikke defineret" }
```

#### Fejlhåndtering og oversættelseslag

Python-motoren kaster undtagelser med engelske tekniske fejlbeskeder. Disse må **aldrig** vises direkte til eleven — en `ZeroDivisionError` eller en SymPy-traceback er meningsløs i en gymnasiekontekst og kan virke afskrækkende.

Fejlpipelinen ser således ud:

```
Python-exception
      │
      ▼
run_in_task() fanger exception
      │
      ▼
{ "type": "error", "code": "ZERO_DIVISION", "message": "...", "raw": "..." }
      │  JSON sendes til JS
      ▼
classifyError() i JS mapper code → dansk brugerbesked
      │
      ▼
UI viser: "Division med nul er ikke defineret"
```

**Python-siden** (`setup.py`) er ansvarlig for at fange undtagelser og returnere et struktureret fejlobjekt med en maskinlæsbar `code`:

```python
def classify_python_error(e):
    err_type = type(e).__name__
    err_str  = str(e)

    if isinstance(e, ZeroDivisionError):
        return "ZERO_DIVISION"
    if isinstance(e, NameError):
        return "UNDEFINED_NAME"
    if "NonInvertibleMatrix" in err_type:
        return "SINGULAR_MATRIX"
    if "NonSquareMatrix" in err_type:
        return "NON_SQUARE_MATRIX"
    if isinstance(e, RecursionError):
        return "RECURSION"
    if isinstance(e, OverflowError):
        return "OVERFLOW"
    # Generisk SymPy-fejl
    if "sympy" in err_str.lower() or "sympy" in err_type.lower():
        return "SYMPY_ERROR"
    return "UNKNOWN"

# I run_in_task's except-blok:
except Exception as e:
    return json.dumps({
        "type":    "error",
        "code":    classify_python_error(e),
        "message": str(e),          # teknisk besked til debug
        "raw":     type(e).__name__ # Python-undtagelsestype
    })
```

**JavaScript-siden** (`main.js` eller et separat `errors.js`) oversætter `code` til dansk:

```javascript
const ERROR_MESSAGES = {
    ZERO_DIVISION:   "Division med nul er ikke defineret.",
    UNDEFINED_NAME:  (msg) => {
        const m = msg.match(/name '(.+)' is not defined/);
        return m ? `'${m[1]}' er ikke defineret i denne opgave.`
                 : "En variabel eller funktion er ikke defineret.";
    },
    SINGULAR_MATRIX: "Matricen er ikke inverterbar (determinant = 0).",
    NON_SQUARE_MATRIX: "Denne operation kræver en kvadratisk matrix.",
    RECURSION:       "Beregningen gik i uendelig løkke. Tjek funktionsdefinitionen.",
    OVERFLOW:        "Tallet er for stort til at beregne.",
    SYMPY_ERROR:     "SymPy kunne ikke beregne dette udtryk. Tjek syntaksen.",
    UNKNOWN:         "Ukendt fejl. Se konsollen for detaljer.",
};

function getUserMessage(errorResult) {
    const handler = ERROR_MESSAGES[errorResult.code] ?? ERROR_MESSAGES.UNKNOWN;
    return typeof handler === 'function'
        ? handler(errorResult.message)
        : handler;
}
```

Den tekniske `message`-streng logges til browserens konsol (til debugging) men vises aldrig i UI.

**Vigtig regel:** Fejlkatalog-tabellen i `DESIGN_LOG.md` opdateres når nye fejltyper identificeres i praksis. Det er bedre at have en god generisk besked end en forkert specifik en.

### 4.4 Settings (`settings.js`)

Et singleton-modul der læser og skriver til `localStorage`. Eksponerer et objekt med to sektioner:

```javascript
settings.user    // angleMode, decimalSeparator, theme, fontSize
settings.engine  // precision, timeout, defaultDomain
```

`settings.save()` og `settings.load()` håndterer persistens. Settings sendes som et immutabelt snapshot til `Transformer` ved instantiering — de ændres ikke under en beregning.

### 4.5 UI (`main.js` + `index.html`)

Event-baseret: lytter på `Enter`-tryk i `.math-input`-felter. For hvert kald:

1. Parser input-strengen til AST
2. Sender AST til engine med korrekt `taskId`
3. Renderer `result.latex` med KaTeX
4. Viser `result.decimal` med korrekt decimalseparator fra settings

---

## 5. Fremtidig arkitektur: WebWorker

Pyodide kører i øjeblikket på UI-tråden. Det betyder at browseren fryser under tunge beregninger. Den planlagte løsning (Fase 5 i roadmap) er at flytte `CASEngine` til en dedikeret **Web Worker**.

Kommunikationsprotokollen vil se således ud:

```
UI-tråd                          Worker
   │                                │
   │──{ type:'calculate',        ──▶│
   │   taskId, code }               │
   │                          regner...
   │◀──{ type:'result',         ──│
   │    taskId, result }            │
```

Dette ændrer ikke pipeline-arkitekturen — kun hvem der kalder hvem. `transformer.js` forbliver på UI-tråden (ingen tung beregning). `cas-engine.js` og `setup.py` flyttes til workeren.

---

## 6. Teknologistak — overblik

| Komponent | Teknologi | Begrundelse |
| :--- | :--- | :--- |
| Parser | Peggy (PEG) | Deterministisk, god fejlhåndtering, velegnet til matematik |
| Transformer | Vanilla ES6 | Simpel rekursiv traversal, ingen afhængigheder |
| CAS-motor | SymPy via Pyodide | Professionel symbolsk matematik i browseren |
| Numerisk/statistik | NumPy + SciPy (planlagt) | Professionelle algoritmer, undgår hjemmebyggede approx. |
| Visualisering | Plotly.js (planlagt) | Interaktiv, browser-nativ, god print-støtte |
| Rendering | KaTeX | Hurtigere end MathJax, deterministisk output |
| Settings | localStorage | Ingen server, fungerer offline |
| Build | Peggy CLI via npm | Automatisk `parser.mjs`-generering fra grammatikkilden |

---

*Rev. 120426 · Erstatter: `Arkitektur_og_dataflow.md (uden rev.)`, `architecture.md (uden rev.)`*
