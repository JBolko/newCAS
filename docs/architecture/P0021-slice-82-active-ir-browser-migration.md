# P0021 Slice 82 — browser migration preparation (NEEDS BROWSER)

## Formål

Etabler en selvstændig browseraccept af **den aktive DocumentRuntime →
resolveret Semantic IR** for sammensatte funktioner, captures og to uafhængige
opgaver. Behold den sidste historiske bound-function-adapter og dens eksisterende
JS/browser-forbrugere, indtil vi har en faktisk tilsvarende Worker-integrationstest.

## Dækning

- Task A og B har samme navne, men forskellige providers og resultater.
- `f(g(4))` samt assignment/læsning gennem aktiv IR-batch.
- Ændring af capture i A uden indvirkning på B.
- Ingen fallback til legacy CASEngine.
- **JS BigInt-testbackend** for `add`, `multiply`, `power`: browserprøven er
  *ikke* en ende-til-ende-afprøvning af nested functions i rigtig Pyodide.

## Accept og efterfølgende oprydning

1. `node --test` — forventet +3 tests, dvs. 916 fra S81's 913.
2. `python -m unittest discover -s tests/python -p 'test_*.py' -v`.
3. `python -m http.server 8000`, åbn
   `http://localhost:8000/tests/browser/p0021-slice-82-active-ir-acceptance.html`.
4. Behold S72 real Worker-prøven som en selvstændig accept af transport/version.
5. **Slet ikke** `create-bound-function-task-evaluator.js` eller dens tests før
   de faktiske Worker-kontrakter er flyttet til den aktive IR-kæde i browseren.

Ingen ændringer i produktionskode eller normative arkitekturbeslutninger.
