# P0021 Slice 22 — symbolske kildeargumenter gennem OperationSpec (GREEN)

**Dato:** 13. oktober 2026
**Afgrænsning:** Peggy-*AST* → dokumentbundet Semantic IR. **Ikke** SymPy/Pyodide-differentiering.

## Motivation og normative regler

Slice 21 tillader almindelige `Variable`-noder, men forudsætter en dokumentejet
`resolveVariable`. Den må ikke anvendes blindt på det symbolske mål i
`diff(x^2,x)`, for et tidligere `x := 17` skal *ikke* substitueres ind i
kildeudtrykket til differentiering. Omvendt må en allerede materialiseret
`A := x^2` aldrig kilde-resolves igen under differentiering:

```text
x := 17
  diff(x^2,x)  -> 2*x  (symbolsk target i kildeudtrykket)
A := x^2
  diff(A,x)    -> 0    (A er allerede materialiseret)
```

Der er tale om **forventet fremtidigt matematisk resultat**, ikke resultater
som denne slice kan udføre i Pyodide.

## Løsning

`compileSelectedSourceAst` modtager nu to **eksplicit dokumentejede**
argumenter ved symbolsk kompilering:

- `lexicalScope`: en eksisterende `LexicalIdentityScope` fra P0006.
- `makeLocalId`: en caller-supplied funktion som allokerer en unik, stabil
  operationslokal identitet for målsymbolet.

`specs: Map<operationId, OperationSpec>` og `resolveVariable(name)` er uændrede
og fortsat eksplicitte. Den nye kompilering **genbruger** P0019
`resolveSelectedOperationCall`; ingen alternativ rolletabel, parser, registrering
eller Python-opslag indføres.

For en allerede valgt operation med én `symbolic`-rolle etableres identiteten
*før* kildeargumenterne besøges. En operationslokal binder i `lexicalScope`
skygger for dokumentets writer, men **kun** hvor P0019's eksisterende
kilde-scope-politik gælder. Andre forekomster af navnet kalder stadig den
caller-ejede `resolveVariable`.

- `diff(x^2,x)` → samme `operation-local` identity i `x^2` og target.
- `diff(A,x)` → provider-reference til `A`, uændret i det nye symbolske scope.
- `integrate(x,x,1,x)` → integrandets `x` er lokalt; det sidste `x` er
  almindelig provider-reference til dokumentets eksisterende `x`.
- `diff(sin(x+1),x)` → lokal identitet føres ind i indlejrede værdioperationer.
- `x + diff(x^2,x)` → yderste `x` forbliver dokumentbundet.

En `symbolic`-rolle uden dokumentejet scope eller identitetsallokator afvises.
Et ugyldigt symbolnavn og et ikke-variabeltarget afvises før dokumentopslag.

## Bevidste grænser

- Højst én `symbolic`-rolle per kald i denne slice. Et generelt multisymbolsk
  kald kræver en særskilt scopekontrakt.
- `scoped` / `scopeOver` accepteres **ikke endnu** i denne kompilator; det
  ville være ukorrekt at behandle dem som `value`.
- Den eksisterende P0019-hjælper anvender foreløbigt en begrænset
  positionspolitik (source-argumenter *før* target). Ingen ny generisk
  scope-algoritme påstås implementeret her.
- Ingen materialiseret Value gennemsøges eller omskrives. Callbacken binder
  uændret til provider-reference eller SemanticIdentity.
- `compileSelectedValueCall`, `evaluateNestedSelectedCalls` og
  Pyodide/Worker understøtter fortsat **ikke** disse nye symbolske IR-argumenter.
  Python har allerede en særskilt, udvalgt `evaluate_diff_request`-handler,
  men den er **ikke** tilsluttet Slice 22-kæden.
- Funktioner, `f(x) := ...`, længere bloksekvenser og regression er uden for
  denne slice. Den faktiske Peggy-parser og browsertest er ikke afviklet her.

## Ændrede filer

```text
src/js/semantics/compile-selected-source-ast.js
tests/js/p0021-symbolic-source-roles.test.mjs
tests/js/p0021-selected-source-ast.test.mjs
docs/architecture/P0021-slice-22-symbolic-source-roles.md
```

Den **eneste** eksisterende testændring i denne slice er forventningen i
`source AST: roles validated against spec`: den skal nu afvise manglende
scope/identitetsallokator frem for at kalde alle symbolske roller generelt
unsupported. Den ældre Slice 21-regression om Python-scope er fortsat intakt.

## RED → GREEN og lokal verificering

Med de 12 første nye tests og den oprindelige Slice 21-kilde:
**10 FAIL, 2 PASS** (RED; alle nye symbolske tilfælde fejlede).

Efter implementering og tilføjelse af navnevalidering:

- Nyt testmodul: **13/13 PASS**.
- Målrettet suite med P0019- og Slice 21-kontrakter: **48/48 PASS**.
- Kurateret delmængde af udtrukne JS-filer (38 testfiler): **494/494 PASS**.
- `PYTHONPATH=src/python pytest -q src/python/tests`: **14/14 PASS**.

**Ikke fuld checkout-verificering.** Repomix indeholder ikke den genererede
`src/js/parser.mjs`, `tests/browser/**`, hele `tests/python/**`,
`node_modules` eller `package-lock.json`. Lokalt er Node.js 22.16 installeret,
mens projektets `package.json` kræver Node 24. `node --test` på hele den
udtrukne delmængde er derfor ikke en troværdig 603-test-baseline.

## Verificer i den rigtige checkout (PowerShell)

```powershell
Expand-Archive -LiteralPath ".\P0021-slice-22-symbolic-source-roles-GREEN.zip" -DestinationPath "." -Force
node --test tests/js/p0021-symbolic-source-roles.test.mjs
node --test tests/js/p0021-selected-source-ast.test.mjs tests/js/p0021-selected-variable-bindings.test.mjs
node --test
```

Pyodide-browser-smoke for **symbolsk differentiering** er endnu ikke meningsfuld,
fordi IR → Value/Python-transporten af symbolske identiteter ikke er tilsluttet.

## Foreslået næste slice (P0021 Slice 23 RED)

Kontrakttest for **symbolsk IR → materialiserede P0005 Values → allerede
udvalgt P0012 `evaluate_diff_request`**. Respekter P0010's `inputs: Value[]`
og P0011's `symbolRef`-adapter, verificer nøjagtig identity mapping ved
symbolligheder og provider-referencer; ingen Python-task-scope, navnegæt eller
ny handler-registry. Start med tests for `diff(x^2,x)`, `diff(A,x)` og
udtryk med to frie symboler af samme displaynavn men forskellig identitet.
