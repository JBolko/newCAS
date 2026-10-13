# P0021 Slice 20 — fortegn, minus og division

Udvider Slice 19s AST→Semantic IR-bro uden ændringer i Peggy, SymPy eller Python. Unært minus sænkes til `multiply(-1,x)`; binær subtraktion til `add(a,multiply(-1,b))`; division til `multiply(a,power(b,-1))`. Alle operationer kræver eksplicit OperationSpec. Ingen float, Python-scope eller skjult parser.

Prioritetsregler afprøves **med den faktiske Peggy-parser i browseren**: `-2^2` og `(-2)^2` har forskellige IR-træer og resultater. Node-tests bruger præcise AST-fixtures og beviser derfor ikke alene den faktiske parser/Worker-kæde.

Bemærk: Generel division, domænefejl og særskilte subtraktions-/divisions-evaluatorer er ikke hermed fuldt specificeret. Denne slice demonstrerer et begrænset, eksakt skalar-udsnit via eksisterende valgte operationer. Decimalpræcision, symboler, funktionsdefinitioner og flere statements er fortsat udskudt.

Kontrol: `node --test tests/js/p0021-signed-source-ast.test.mjs`, `node --test`; start `python -m http.server 8000`, åbn `http://localhost:8000/tests/browser/p0021-signed-source-worker-smoke.html`. Hvis browseren viser gammel kode, brug Ctrl+F5; Worker-URL og entrypoint er versionsmærket, men transitive imports kan stadig caches.
