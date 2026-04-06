# Systemarkitektur: Modern-CAS

## Overordnet Flow
Systemet er bygget som en lineær pipeline, der transformerer rå tekst til matematiske resultater via et Abstract Syntax Tree (AST).

1. **Input (UI):** Brugeren indtaster matematisk notation (f.eks. `f(x) := x^2`).
2. **Lexing/Parsing (Peggy):** `parser.js` (ES6 modul) læser strengen og validerer syntaksen jf. `grammar.pegjs`.
3. **AST Generering:** Parseren returnerer et "rent" JSON-objekt (AST), hvor alle whitespaces og irrelevante tokens er fjernet.
4. **Transformation (JS):** `transformer.js` traverserer AST'en rekursivt og mapper noderne til SymPy-kompatibel Python-kode.
5. **Execution (Pyodide):** Den genererede Python-streng sendes til WebAssembly-instansen af Python, hvor SymPy udfører de symbolske beregninger.
6. **Output:** Resultatet returneres til JavaScript som en streng eller et tal og præsenteres i UI.

## Node Typer i AST
| Type | Beskrivelse | Eksempel (Input) | Python Output |
| :--- | :--- | :--- | :--- |
| `Assignment` | Tildeling af værdi | `g := 9.82` | `g = 9.82` |
| `FunctionDefinition` | Definition af funktion | `f(x) := x^2` | `f = Lambda(x, x**2)` |
| `BinaryExpression` | Matematiske operationer | `a + b` | `(a + b)` |
| `Quantity` | Tal med enhed | `100 [m]` | `(100 * units.m)` |
| `Vector` | Matematiske vektorer | `[3, -4]` | `Matrix([[3, -4]])` |
| `Equation` | Ligninger til løsning | `x + 2 = 5` | `Eq(x + 2, 5)` |
| `Access` | Liste/Vektor indeksering | `v[1]` | `v[0]` (0-baseret) |

## Teknologistak
- **Parser Generator:** Peggy.js
- **Runtime Environment:** Browser (ES6 Modules)
- **Python Bridge:** Pyodide (WASM)
- **Math Engine:** SymPy