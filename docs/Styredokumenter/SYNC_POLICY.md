# newCAS - Sync-politik

Formålet er at gøre projektet let at genoptage efter lange pauser.

## Autoritetsrækkefølge

```text
Grammatik.pegjs  -> syntaks
registry.py      -> offentlige funktioner
cas_math/*.py    -> implementation
output/result.py -> JSON for succesfulde resultater
output/errors.py -> fejlkontrakt
E2E/tests        -> testbekræftet adfærd
Styredokumenter  -> forklaring og roadmap
```

## Nye CAS-funktioner

Tilføjelse sker i fire trin:

1. implementér i relevant `cas_math`-modul
2. registrér i `registry.py`
3. skriv isoleret og E2E-test
4. opdatér funktionskataloget

Grammatikken ændres kun, når **syntaksen** ændres.

## JSON

`type` og feltnavne behandles som API-kontrakter.

Feltet `decimal` er historisk navngivet og er en **displaystreng**. Den er ikke garanteret
at indeholde ét numerisk tal; symbolske, komplekse og liste-resultater kan også have tekstlig
repræsentation her. Frontend'en skal dispatch'e på `type` og må ikke generelt kalde `parseFloat()`
på `decimal`.

## Roadmap

En feature må kun være markeret færdig, hvis der findes tests, der dokumenterer den faktiske adfærd.

## Snapshot-regel

Dokumentation skrevet ud fra et Repomix-snapshot må ikke fremstille ikke-leverede JS-filer som verificeret kode.