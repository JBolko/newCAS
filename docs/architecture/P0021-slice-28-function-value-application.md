# P0021 Slice 28 — ren anvendelse af FunctionValue

## Kontrakt og afgrænsning

`applySelectedFunctionValue(fn, args)` anvender en allerede materialiseret P0005 `FunctionValue` på en liste af allerede beregnede **ExpressionValues**. Der foretages kun strukturel substitution af `symbolRef` efter **SemanticIdentity** (`identityKey`), aldrig efter visningsnavne, Python-scope eller dokumentets variable. Captures kommer fra selve FunctionValue og indsættes ved deres eksakte identiteter.

Returneres: en ny immutable P0005 ExpressionValue med det substituerede udtryk. **Ingen aritmetisk simplifikation eller Python-evaluering**. Testen `f(t):=t^3+4t` med argument 12 kontrollerer 1776 via en separat lille *test-only* evaluator af heltalsudtrykket; implementeringen selv beregner ikke 1776.

Afvisninger: andet end FunctionValue, forkert aritet, ikke-expression argumenter/captures, kolliderende binder/capture-identiteter, ubundne symbolidentiteter, ubrugte captures og udtryk uden for den afgrænsede operationelle familie. Ingen implicit resolution.

## Arkitektur

Kun ét nyt JS-modul. Ingen ændring af P0005, Semantic IR, P0008, P0010, Python eller Worker. Opkalderen/document-runtime skal senere levere og vælge den korrekte FunctionValue og evaluere det returnerede udtryk via eksisterende gateway. Næste slice bør knytte funktionens callable-provider til faktisk dokumentbinding og selected execution.

## Tests

`node --test tests/js/p0021-function-application.test.mjs`

`node --test`

Målrettet: seks tests grønne i det rekonstruerede snapshot (Node 22). Fuld Node 24-regression skal bekræftes i brugerens checkout. Forventet hvis baseline 643 er uændret: 649 tests.
