# P0021 — Slice 93b: fælles kildeudtryks-traversering (GREEN-kandidat)

Dato: 2026-10-17

## Baggrund

Claude S90a identificerede to kompilatorveje. S93a samlede aritmetisk lowering, men
begge kompilatorer gennemløb fortsat Peggy-AST'en selvstændigt. Det indebærer risiko
for drift i den accepterede *struktur* af almindelige udtryk.

## Ændring

`lowerSourceExpressionTree` er en **ren, intern kompilatorprimitiv** for en enkelt
Peggy-udtryks-AST. Den håndterer alene AST-formerne `Literal`, `Variable`,
`FunctionCall`, `UnaryExpression`, `BinaryExpression` og `PowerExpression`.

Begge eksisterende kompilatorer anvender nu den samme strukturelle gennemgang.

- `compileSelectedSourceAst` ejer stadig leksikale identities, symbolroller og
  OperationSpec-valg. Der kan ikke vælges en uregistreret operation.
- `compileAttestedDocumentExpressionIR` ejer stadig P0020's attesterede
  dokumentreferencer, callable-providers, writer-attestation og forbrugskontrol.
  Der er ingen navn-baseret fallback efter binding.
- `createSelectedArithmeticLowering` ejer stadig den fælles aritmetiske
  IR-oversættelse fra S93a. Den nye komponent kalder kun dens eksisterende API.

Hverken DocumentRuntime, dispatcher, IR-evaluator, Worker, Python eller den gamle
CASEngine ændres. Der er ingen ny parser, generator eller Python-kodevej.

## Kontrakttests

`p0021-slice-93b-shared-expression-traversal.test.mjs` kontrollerer:

1. Den fælles traversal kan ikke selv vælge operationer eller slå navne op.
2. Dokumentets funktionskald bevarer en attesteret provider-reference; en
   uattesteret callable afvises.
3. Leksikale funktionsparametre skygger dokumentnavne uden at ændre identity.
4. Ugyldige AST-noder og operatorer afvises uden at besøge deres børn.
5. Samme almindelige AST giver identisk frossen IR i de to kompilatorveje.

Eksisterende fokuserede regressioner skal også være GREEN.

## Bevidst UÅBNE forhold

- F6/F7: frie symboler, funktionskomposition og symbolske bindinger.
- Attesterede funktionsdefinitioner i multistatement-blokke.
- Én samlet kompilator-**politik**: de to entry points bevares, fordi deres
  myndighed er forskellig. Denne slice deler kun mekanisk traversal, ikke
  binder- eller attestationsregler.
- Aktiv UI er fortsat legacy; ingen release.

Dette er **ikke** en adapter mellem motorer og ændrer ikke frosne v1-kontrakter.

## Accept

Lokalt med Node 22: 82/82 fokuserede JS-tests GREEN; Python 264/264 GREEN.
Fuld Node 24, kanonisk parsercheck og Python på brugerens maskine er nødvendig,
før kandidaten må kaldes GREEN. Slices er repo-relative og indeholder ingen
logs eller udviklingsarkiver i releasepakken.
