# P0021 Slice 93c — funktionskald i funktionskroppe, RED-kontrakt

Dato: 2026-10-17. Status: **RED accepteret som reproduktion, ikke funktionel GREEN**.

## Afgrænsning

Denne slice tilføjer **ingen produktionskode**. Efter S93a/S93b, der samlede aritmetisk lowering og
AST-traversering, skal vi dokumentere præcist, hvor den aktive funktionskompilering stadig adskiller sig
fra almindelige attesterede udtryk. Det er en bevidst RED-fase, ikke en ny evaluator eller adapter.

## Forventet adfærd

1. `f(x):=x+1; g(x):=f(x)*2; g(3)` på tre separate, ordnede blokke giver `8`.
2. `a:=2; f(x):=a*x+1; g(x):=f(x)+f(1); g(3)` giver `10`. Funktionskald og capture
   skal bevare positionsbestemt provider-identitet.
3. `f(x):=x+1; g(x):=f(x)*2; f(x):=100x; g(3)` giver `8`, fordi den senere
   definition ikke må overtage den tidligere binding.

De tre tests ligger i `tests/pressure/*.red.mjs`, så standard-`node --test` **ikke** får forventede
fejl som en regression. De køres udtrykkeligt som STRICT-RED og skal give 3/3 røde på S93b-baseline.
En anden fejlfordeling kræver undersøgelse, ikke automatisk godkendelse.

## Grønne regressionsvidner

`tests/js/p0021-slice-93c-function-composition-boundary.test.mjs` (3 GREEN) bekræfter:
- `f(f(2))` virker i aktiv DocumentRuntime -> IR, uden legacy.
- en funktion med leksikalsk fanget scalar `a` bruger den tidligere provider, selv efter en omdefinition.
- et fremadrettet, uafklaret funktionskald fejler lukket.

## Arkitekturkontrakt før implementering

- P0020's positionsbundne source-writers og dokumentets ordnede rækkefølge er autoritative.
- `FunctionDefinition` må ikke få en alternativ navneopløsning eller skjult dynamisk lookup.
- Både funktionen der kaldes, og øvrige captures skal have entydige provider-referencer ved definition.
- Ingen Python-kodegenerering; den nye motor bruger udelukkende Value/Semantic IR/OperationSpec.
- `materializeSelectedFunctionValue` understøtter i dag kun et snævert udvalg af aritmetiske
  operationskald og expression-captures. Det kan ikke antages, at et kald i en funktionskrop er en
  elementær operation. Kræver eksplicit design af callable-captures og funktionsapplikation.
- Ingen ændring af frozen v1 eller multi-statement-blokke i dette trin.

## Opfølgningsslice

S93d skal først fastlægge en reel, typekontrolleret repræsentation for callable-capture i
FunctionValue, dens semantiske identitet og evaluering, der genbruger den aktive IR-/Value-vej.
Implementationen skal gøre RED-93c-1..3 GREEN uden at lempe attestationskontrollerne.

## Lokal verificering

S93b-snapshot, Node 22: 3/3 GREEN-kontroller; 3/3 forventet RED på pressure;
Python 264/264 GREEN. Den fulde Node 24-bekræftelse sker i brugerens repository.
