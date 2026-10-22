# S100h — kvartiler: beslutningsgate før implementering

**Efterfølgende afklaring:** Brugeren har eksplicit valgt at gentage singleton-observationen i alle kvartiler og i femtalsresuméet. Beslutningsgaten nedenfor er historisk og er nu lukket. Implementeringsstatus og nye testbeviser føres i `P0021-slice-100h-exact-quartiles.md`.

22. oktober 2026. Historisk status ved første aflevering: **STOPPET før RED/implementering**, ikke GREEN. Informativ analyse og lille beslutningsforslag. Basis `bb0e05b` med verificeret S100g i worktree. På dette tidspunkt var eneste S100h-ændring denne rapport; ingen H-operationer eller diagnoser var registreret. Resten af analysen nedenfor bevarer denne daværende status; den efterfølgende godkendelse og implementering fremgår ovenfor og af slutrapporten.

## Præcis matematisk konflikt

Brugeren har valgt median-of-halves med central observation udeladt ved ulige n. S99_KONTRAKTUDKAST §5.2 beskriver samme metode, men siger udtrykkeligt, at operationskontrakten for små datasæt n=0,1 udestår. En biblioteksstandard må derfor ikke vælges automatisk.

Med sorterede observationer x1 ≤ … ≤ xn fås uden yderligere beslutning:

| n | Nedre / øvre halvdel | [Q1,Q2,Q3] |
| --- | --- | --- |
| 0 | Ingen observationer | Afvises allerede af slicens ikke-tomme inputdomæne |
| 1 | Begge halvdele tomme efter udeladelse af x1 | Q2=x1; Q1 og Q3 er ikke bestemt af metoden |
| 2 | [x1] / [x2] | [x1,(x1+x2)/2,x2] |
| 3 | [x1] / [x3] | [x1,x2,x3] |

Der er ingen matematisk/Value-konflikt for n≥2. n=1 kræver en ny eksplicit randregel. S100g's median/min/max for singleton er fortsat definerede og GREEN; deres eksistens fastlægger ikke kvartilernes randregel.

## Beslutningsforslag — afventer brugerens svar

**Anbefaling:** Begge H-operationer kræver mindst to observationer. `quartiles({a})` og `five_number_summary({a})` afvises med eksisterende `type-mismatch`, parametre `{operationId, argument:"data", expectedKinds:["list-of-at-least-two-exact-rational-expressions"], actualKind:"list"}`. Descriptoren findes allerede til S100f; ingen ny kode eller Value-kind behøves. Dette bevarer metoden uden en ekstra matematisk singletonkonvention.

**Alternativ:** Godkend eksplicit singletonreglen Q1=Q2=Q3=a og femtalsresumé [a,a,a,a,a]. Det er en udvidelse af den valgte metode, fordi de tomme halvdele ellers ikke har en median. Den må dokumenteres og testes som en særlig regel.

Spørgsmålet er stillet under arbejdet. Der er ikke modtaget en beslutning ved aflevering; ingen af mulighederne er indført. Ingen FROZEN-/ADR-ændring foreslås. S100g er afsluttet selvstændigt som autoriseret.

## Foreslåede RED-tests efter beslutningen

1. Begge pure unary `data:value`-OperationSpecs og eksplicit Worker-dispatch; ingen navnedubletter.
2. n=2: `{1,3}` → kvartiler [1,2,3], femtalsresumé [1,1,2,3,3]. n=3: `{3,1,2}` → [1,2,3] og [1,1,2,3,3]. n=1 testes efter den valgte regel; n=0 afvises struktureret.
3. Reference n=7 → [2,4,6] / [1,2,4,6,7]; n=8 → [5/2,9/2,13/2] / [1,5/2,9/2,13/2,8]. Gentagelser, usorteret input, negative, rationale, eksakte decimaler og store heltal.
4. Vector, nested og approx afvises med eksisterende strukturerede diagnoser; intet input muteres.
5. Rigtig kilde→IR→Worker→SymPy→ListValue-retur, encode/decode og immutable rehydrering, anvendelse af det returnerede resultat som input til fx `median`, dokumentprovider-redigering og korrekt genberegning/opgaveisolation.
6. Fokuseret G/H-regression, fuld npm test, parser-sync og diff-check på H-koden før en H-GREEN-påstand.

Ingen aktive fejlede tests eller nye TODO/SKIP er lagt i suiten for det uafklarede valg. Der er derfor **ingen H-RED→GREEN-, fuld npm- eller H-browseraccept**. G's aktuelle fulde suite og browserbeviser findes i G-rapporten og er ikke omdøbt til H-accept.

## Transport og præsentation undersøgt uafhængigt af kvartilreglen

P0005 tillader ordnede immutable ListValues af almindelige Values. P0007 bruger eksisterende call og P0008 kan udtrykke de foreslåede unary operationer. P0010 success kan indeholde en ListValue. Python må adaptere hvert skalarelement og samle en almindelig liste-envelope, efter samme mønster som den eksisterende container-handler; ingen ny StatisticsValue eller generel adaptertype er nødvendig.

I denne kørsels **rigtige G-browseraccept** returnerede eksisterende `probe.container.list` kildedata gennem Worker/Pyodide/P0010 til DocumentRuntime; testen kontrollerede elementrækkefølge, gentagelser og frosne tidligere listeelementer. Dette er transportgrundlag, ikke bevis på endnu uimplementerede H-resultater.

En særskilt Node-probe med ListValue [2,4,6] gav tabsløs encode/decode og frossen liste, men `renderSemanticCalculation({status:"success", result:list}, output)` skrev **`PRESENTATION_UNSUPPORTED_VALUE`**. Den selected renderer accepterer kun function eller understøttede ExpressionValue-blade; legacy-rendererens list-gren er ikke en selected løsning. **Listevisning er derfor en særskilt åben UI-gate.** Renderer er ikke ændret; H-backendaccept kan senere opnås selvstændigt, mens UI-gaten forbliver tydelig.

## Krav til fremtidige intervalgrupperede observationer

- Faktisk observeret minimum og maksimum kan ikke bestemmes alene ud fra intervalgrupperede observationer.
- Klassegrænser må aldrig implicit behandles som observerede ekstremværdier.
- Sådanne fremtidige operationer skal give strukturerede, sprog-uafhængige diagnoser, når nødvendige fakta mangler.
- Danske fejltekster og øvrig i18n hører til præsentationslaget.
- Grupperede medianer og kvartiler skal være tydeligt markeret som estimater.

Ingen grupperet beregning, nye diagnosekoder, datatyper, grafik eller elev-UI er implementeret her.
