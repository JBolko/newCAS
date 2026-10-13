# P0021 Slice 43 — Positionsbestemt funktionsberegning (GREEN)

**Baseline:** 736 JS-tests bekræftet af brugeren efter Slice 42. **Omfang:** én afgrænset kildeadapter for `f(<safe integer literal>)`, syv tests. Ingen ændring af de frosne kontrakter.

## Hvorfor

Slice 41–42 beviste binding og planlægning ved indsættelse/sletning af funktionsdefinitioner, men ikke den konkrete matematiske beregning. Slice 43 forbinder P0020's eksakte callable-provider med en integer-Value fra selve kildekoden. `createValueEvaluator` indhenter den udvalgte providers aktuelle `FunctionValue`; `evaluateBoundSourceFunctionCall` og eksisterende aritmetiske operationer udfører kaldet. Ingen global funktionslookup eller persistent Python-scope.

## Verificerede forløb

- `f(x):=x^2+3x; f(10); f(3)` giver 130 og 18.
- Indsæt `f(x):=2x+1` imellem kald: 130 og 7.
- Fjern den indsatte definition igen: sidste kald bliver 18.
- Fjern den første definition: `f(10)` er unresolved og fejler *før* matematik-evaluering; `f(3)` er 7.
- Ved bortfald af et forventet provider-outcome svarer batch-dispatcheren `missing-upstream`, ikke en opdigtet succes/fallback; kaldet køres ikke.
- Ikke-heltallige kildeargumenter afvises eksplicit i denne snævre adapter.

## Afgrænsning

Der anvendes eksisterende, kildespecifikke provider-FunktionValues, som testharnessen materialiserer fra kildeblokke. Den nye adapter understøtter **kun præcis ét heltalsliteral-argument** og er ikke en generel udtryksevaluator; den implementerer heller ikke kildeændringer eller commit af visningstilstand i den gamle `DocumentRuntime`.

**Næste skridt:** begynd migrering af DocumentRuntime til de dokumentejede P0020/P0021-analyser og revisionsbeskyttede outcomes. Ved fjernelse af en definition skal en tidligere succesfuld visningsværdi ryddes, og unresolved skal få en gyldig dokumentdiagnostik — ikke blot en undtagelse i en unit-test. Ingen duplikerede provider-registries eller alternativ scope-model.
