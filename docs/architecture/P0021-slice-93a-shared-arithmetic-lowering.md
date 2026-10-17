# P0021 Slice 93a — fælles aritmetisk lowering i den nye Semantic IR

**Status:** GREEN-kandidat (kræver brugerens Node 24-accept)\
**Dato:** 2026-10-17\
**Scope:** Kun `src/js/semantics` og tests. Ingen ændring i frosne v1-kontrakter.

## Baggrund

Claudes checkpoint-review fandt to delvist overlappende source→IR-kompilatorer:

- `compile-selected-source-ast.js` anvendes til bl.a. funktionskroppe med leksikale bindere og operation-roles.
- `compile-attested-document-expression-ir.js` anvendes til dokumentudtryk med P0020-attesterede provider- og callable-identiteter.

De to veje sænkede tidligere aritmetik (`+`, `-`, `*`, `/`, `^`, unary `-` og heltalsliteraler) hver for sig, selv om denne del ikke afhænger af bindermodellen.

## Beslutning og afgrænsning

Introducér **én ren arithmetic-lowering** i `lower-selected-arithmetic.js`, brugt af **begge** eksisterende kompilatorer. Hver kompilator ejer fortsat:

- Valg og kontrol af `OperationSpec` og argumentroller.
- Leksikale og operation-lokale bindere **eller** P0020-attesterede provider/callable-bindinger.
- Writer-attestation og Definition/FunctionValue-semantik.
- Den eksisterende kilde- og AST-grænse.

Den fælles lowering må ikke selv slå symboler op, vælge backend, kalde Python, parse kildetekst eller skabe en ekstra evaluator. Alle matematiske operationer går fortsat gennem den af kalderen valgte `selected(operationId, args)`.

Dette er **ikke** en samlet funktionskompilator eller ny dispatch-vej. En egentlig harmonisering af funktioner/captures kræver senere egne, testdrevne slices.

## Invarianter

1. `a-b` er `add(a, multiply(-1,b))`; `a/b` er `multiply(a, power(b,-1))`. Ingen stiltiende taltilnærmelse.
2. Hele `Literal`-værdien skal være et ikke-negativt `Number.isSafeInteger`; præcisionstab kan ikke accepteres som eksakt litteral (F8 forbliver åbent).
3. Manglende/ikke-valgt `OperationSpec` afvises af den eksisterende kalder, ikke af en ny global registry. Returnering af andet end gyldig Semantic IR fra callbacken afvises også.
4. Manglende attestation, ukendte dokumentnavne og ugyldige bindere fejler fortsat lukket.
5. Ugyldige unary-operatorer afvises **før** besøg af deres operand (ingen utilsigtede provider-reads).
6. Output er uforanderligt Semantic IR, og begge kompilatorveje producerer byte-identisk serialisering på det fælles aritmetiske delmængdesprog.

## Tests og exit

- Ny `p0021-slice-93a-shared-arithmetic-lowering.test.mjs` med direkte parity-tests, fail-closed tests, capability-krav og evalueringsrækkefølge.
- Eksisterende kompilerings- og funktions-tests bevares uændret.
- Lokal Node 22: 19/19 fokuserede aritmetiske tests + 22/22 funktions-/IR-integrationstests GREEN; Python 264/264 GREEN.
- Fuld Node 22-regression: 7 fejl og 3 cancelled, **identisk** med den rekonstruerede præ-slice-tilstand (manglende Peggy, ældre indlejrede tests m.m.). Kan ikke anvendes som Node 24-accept.
- Node 24 exit kræver alle fokuserede tests, parser-synk, fuld JS og fuld Python GREEN.

## Udtrykkeligt ikke løst

- F6 frie symbolske variabler og funktionskald i funktioners bodies.
- F7 operation-lokale/scoped bindere.
- F8 decimal- og eksakt literal-transport.
- S90b flere statements i aktiv DocumentRuntime.
- S94 Worker supervision.
- Endelig UI-migration og udfasning af legacy Python `exec`/`eval`.

**S93b-retningslinje:** Indfør først en arkitektonisk kontrakt for fælles source-expression kompilering og P0020-attestation af frie/callable navne. Undgå at sammenkoble de to kompilatorer gennem en ny ad hoc fallback.
