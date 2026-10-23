# S100l — kontraktforslag for intervalgrupperede observationer

**Status: INFORMATIVE / PROPOSED — ikke FROZEN, ikke en accepteret ADR.**

**Beslutningsopdatering:** Se [S100l beslutningslukning](P0021-slice-100l-decision-resolution.md). Brugeren har nu godkendt dansk højrelukket klassekonvention og metode A `piecewise-uniform-cdf/v1`, inklusive grouped singleton og plateau-regler. Addendum skelner USER-ACCEPTED matematik fra PROPOSED arkitektur og OPEN kontraktgates. Forslaget her er fortsat informativt; ingen ny Value-/dokument-/persistenskontrakt er accepteret eller implementeret.
22. oktober 2026. Basis: `architecture-v1-implementation`, checkpoint `c5fd1f7`, med S100k verificeret særskilt. Dette dokument indeholder analyse, referenceberegninger og beslutningsforslag. **Ingen grupperet produktionsfunktion, parserregel, Value-kind, diagnosekode, dokumentindstilling eller persistensændring er implementeret i S100l.**

## 1. Konklusion og beslutningsgrænse

Anbefalingen er en eksplicit intervalgrupperet datamodel med **navngivne klassefelter, endepunktsflag, absolutte counts, metode og estimatstatus**. De eksisterende diskrete operationer må fortsat betyde faktiske observationsværdier. Klasser, midtpunkter og observerede ekstremværdier må ikke blive semantisk identiske.

Brugerens supplerende danske konvention indgår direkte: **venstreåbne, højrelukkede klasser anbefales som dokumentstandard for danske statistikdokumenter**, eksempelvis `]0;10]`, `]10;20]`, `]20;40]`. Dette er en matematisk konvention. En fælles grænse tilhører klassen til venstre. Denne retning er brugerfastlagt; den konkrete dokument-/Value-kontrakt er stadig et forslag. Eksempler med den modsatte lukning i den oprindelige opgavetekst er ikke den anbefalede danske standard.

De vigtigste åbne valg er den fremtidige typedata-/resultatrepræsentation, propagation ved aritmetik med estimater og integration af dokumentkonventioner. Interpolationsmetode A er nu brugeraccepteret som beskrevet i addendum. De resterende arkitekturvalg kræver eksplicit godkendelse før implementering. En P0005-/P0010-ændring skal versionsvurderes; S100l vedtager ingen ændring af frosne kontrakter.

## 2. Eksisterende kontrakter og faktiske kodefund

| Grundlag | Kan genbruges | Afgrænsning/gate |
| --- | --- | --- |
| FROZEN §§14–16,25–26; review-resolution §2.10 | Typed immutable Values, ingen implicit containerkonvertering, stateless evaluator og matematisk betydning før præsentation | Nye rige typer må ikke skjules som uvaliderede objektfelter |
| Accepted ADR-0004/-0006 | DocumentRuntime ejer kilder, positionel binding, opgaveisolation, invalidering og resultater | Ingen ekstra gruppedatamodel med selvstændig dokumentautoritet |
| Accepted ADR-0005 | Genberegneligt dokument og historisk afleveringssnapshot har forskellige livscyklusser | Historiske metoder/konventioner skal bevares; konkret fremtidigt filschema er ikke vedtaget her |
| P0005 Value v1 | Eksakte integer/rational ExpressionValues, ListValue og SetValue-intervalgrænser | Statistikklasser og estimaters semantiske metadata mangler en konkret Value-kontrakt |
| P0006/P0007 | Opløste provideridentiteter, almindelige calls og materialiserede Values | Klasse-id'er er ikke automatisk dokumentwriters eller symbolske identiteter |
| P0008 | Rene operationer med eksplicitte value-roller; aritetsbaseret signaturvalg | Flere signaturer med **samme aritet** udvælges ikke efter Value-kind; undgå sådan en fiktiv overload |
| P0009 | Sprog-uafhængige strukturerede diagnoser og eksplicitte producentschemaer | Forslag til nye codes nedenfor er ikke registreret eller allerede godkendt |
| P0010 | Materialiserede Values og eksplicit evaluatorlokal instruction/options | Success er præcis `{evaluationOutcomeVersion,status,value}`; ingen fri estimatmetadata ved siden af Value |
| S100g–k og `_DiscreteObservations` | Eksakt tælling, vægtede momentberegninger og komprimerede repræsentationer | Diskrete rangkvartiler er ikke automatisk en grupperet interpolationsmetode |

Konkret undersøgt: `src/js/values/value.js`, `src/js/evaluator/evaluation-contract.js`, `src/js/document-runtime.js`, `src/js/settings.js` og `src/python/evaluator/list_statistics.py`. Katalog/compiler/Worker er de samme som i K. ADR-0007 er fortsat **Proposed**, ikke normativ. S99_KONTRAKTUDKAST §§5 og 11 er informativ retning, ikke en implementeret fil-/Value-kontrakt. Accepted P0002-ADR giver heller ikke automatisk accept af en ny dependency eller datamodel.

### 2.1 SetValue er nyttig evidens, ikke en statistisk klasse

Den eksisterende kode kan repræsentere `Value(kind:"set", data:{setKind:"interval",lower,upper,lowerClosed,upperClosed})`. Endepunkter er ExpressionValues; finite integer/rational-værdier kan derfor bevares tabsløst. Infinity-markører er særlige boundary-objekter, ikke tal eller almindelige Values. De må kun stå som korrekt rettet, åbent yderendepunkt.

Ad hoc-kodeprober bekræftede, at eksplicit `(lowerClosed:false, upperClosed:true)` accepteres og roundtrippes. Den almindelige `interval(...)`-konstruktør har derimod **begge flag false som default**; den er ikke en dansk klassekonstruktør. Value-valideringen accepterer endda et strukturelt korrekt interval med lower=10, upper=0. Statistisk validering skal selv kontrollere numerisk orden, bredde, dækning og overlap; strukturel Value-validitet er ikke et matematisk partitionsbevis.

`P0005-P0012-slice-20-set-extension.md` beskriver ubegrænsede intervaller og unioner, men dokumentets status er stadig **proposed compatible extension**. Implementeret kode er observeret evidens; denne tekst gør ikke tillægget normativt ved stiltiende at omdøbe det til accepted.

En matematisk mængde udtrykker medlemskab, mens en statistisk klasse også har count, plads i en partition og et datagrundlag. Set-union må ikke normalisere/sammenlægge klasser og miste counts. Der må hverken ske automatisk `SetValue → statistisk klasse` eller `ListValue af midtpunkter → kendte observationer`.

## 3. Anbefalet datamodel og dansk dokumentstandard

Følgende er **begrebsskitse**, ikke et nyt gyldigt P0005-objekt eller gemmeformat:

```text
GroupedBasis {
  basisKind: "interval-grouped",
  basisVersion: <skal besluttes>,
  coveragePolicy: "contiguous",
  classes: [
    {lower: ExactExpressionValue, upper: ExactExpressionValue,
     lowerClosed: false, upperClosed: true,
     count: ExactNonnegativeIntegerExpressionValue}, ...
  ]
}
```

Navngivne felter holder grænser og counts sammen; ingen offentlig række som `[0,10,0,1,2]` med skjult positionsbetydning. En fremtidig konstruktor kan modtage parallelle klasse-/count-inputs og derefter danne sådanne records. De skal parres **før** sortering. Counts og grænser gemmes som eksakte Values med heltalsstrenge; count/N/rang må ikke blive Number. Første afgrænsede implementering bør bruge finite, enhedsløse, eksakte rationale grænser; units/symbolske eller approx-grænser kræver særskilt domænebeslutning.

### 3.1 Konventionsprofil og i18n

Illustrativ fremtidig dokumentprofil:

```text
statisticsConventions {
  profileId: "da-statistics/v1",
  defaultClassClosureId: "left-open-right-closed/v1",
  firstLowerEndpointPolicy: "explicit"
}
displayLocale: "da-DK"  // separat præsentationsvalg
```

Profilen vælges ved oprettelse af et dansk statistikdokument og bliver autoritativ dokumentdata, ikke en aflæsning af det aktuelle UI-sprog ved hver beregning/genåbning. Alle materialiserede klasser har konkrete booleans. Interpolationsmetode A er nu matematisk accepteret; dens integration i en konkret versionsbestemt dokumentprofil er fortsat OPEN. Momentmetoden er fortsat et forslag.

At skifte præsentation fra dansk `]0;10]` til international `(0,10]` ændrer **ingen** flag, counts eller beregning. `[0,10)` er en anden matematisk klasse og kan ikke vælges alene ved sprogskift. Decimal-/argumentseparatorer og konkrete inputaliaser er fortsat en parser-/languageVersion-opgave; notationseksemplerne her er ikke ny fungerende kildesyntaks.

Den nuværende `settings.js` er en mutable bruger-/motor-singleton med localStorage. Den er **ikke** en eksisterende autoritativ dokumentstandard for dette. S99's `documentOptions`-skitse er heller ikke et implementeret schema. En senere slice skal beslutte dokument-/opgaveniveau, persistens/migration og eksplicit transport af relevante konventioner til Worker. Ingen ny sidekanal eller Python-scope må indføres.

Ved ændring af en matematisk dokumentkonvention skal berørte konstruktioner/genberegninger invalideres i en autoritativ transaktion. Eksplicitte klasseflag forbliver eksplicitte; kun konstruktioner, der faktisk anvender dokumentdefaulten, afhænger af den. Sprog-/formatteringsskift må ikke ændre semantik. Ældre filer får en fast versionsbestemt legacy-profil eller diagnose/migration, aldrig dagens brugerdefault. Submitted snapshots følger ADR-0005 og genberegnes ikke stiltiende.

### 3.2 Første nedre grænse og præcis medlemskab

Standardeksemplet er:

| Klasse | Flag | Betydning |
| --- | --- | --- |
| `]0;10]` | false / true | 0 < x ≤ 10 |
| `]10;20]` | false / true | 10 < x ≤ 20 |
| `]20;40]` | false / true | 20 < x ≤ 40 |

| Observation | Standardpartition | Eksplicit første klasse `[0;10]` |
| --- | --- | --- |
| 0 | Udenfor; må ikke automatisk medregnes | Første klasse |
| 10 | Første klasse | Første klasse |
| 20 | Anden klasse | Anden klasse |
| 40 | Tredje klasse | Tredje klasse |

**Anbefaling:** Inklusion af 0 kræver en eksplicit første-klasse-undtagelse `lowerClosed:true`, eller et bevidst andet nedre endepunkt. Ingen skjult epsilon, afrunding, automatisk underflow-klasse eller »første klasse er altid lukket«-regel. Ved senere gruppering af rå data skal observationer uden for partitionen give en kontrolleret diagnose; de må ikke tabes. En første-klasse-undtagelse skal bevares ved sprogskift og serialisering ligesom de øvrige flag.

## 4. Klassevalidering, bredder, nulcounts og yderklasser

Anbefalet første valideringskontrakt:

1. Valider **alle** endepunkter, flag og counts før udeladelse af beregningsbidrag, også når count=0. Counts er heltal ≥0 med samlet N>0.
2. Finite klasser kræver lower<upper og positiv eksakt bredde w=upper−lower. Punktklasser med bredde 0 afvises i dette domæne; de er ikke implicit diskrete observationer.
3. Sortér parrede records numerisk efter lower/upper og deterministiske flag. Originalt input ændres ikke. Ingen tekstsortering eller selvstændig sortering af counts.
4. Afvis dublerede/overlappende klasser, også ved nulcount. Ved fælles grænse skal præcis én nabo indeholde punktet: to lukkede giver dobbelttilhørsforhold, to åbne giver et udækket punkt. Den danske false/true-standard opfylder dette med tilhørsforhold mod venstre.
5. Anbefal i første version **sammenhængende partition uden huller**. Geometriske huller må ikke stiltiende betyde enten ukendte eller nul observationer. En senere udvidelse kan kræve eksplicit erklæring om kendt tomt område; modellen skal adskille dette fra manglende dækning.
6. Bevar nulklasser i grouped-basis, selv når de ikke bidrager til momenter. De dokumenterer kendte tomme intervaller, bredder og flade stykker på en sumkurve. Det er en forskel fra K's udeladelse af diskrete nulrækker.

Forskellige bredder er tilladt og skal bruges i density/interpolation. Eksempelvis er `]0;10]` og `]20;40]` et hul, ikke den fulde standardpartition; `]0;15]` og `]10;20]` overlapper. En nulcount på den ene klasse legaliserer ikke overlap eller en ugyldig grænse.

Åbne yderklasser som `]−∞;0]` og `]20;+∞[` kan senere bevares som grænsemarkører med uendeligheden **åben**. Counts/frekvenser og finite kumulerede grænsepunkter kræver ikke midpoint og kan være meningsfulde. Et positivt besat ubegrænset interval har derimod ingen endelig bredde/midpoint, og uniform interpolation dér er ikke defineret. Returnér struktureret utilstrækkelig-information for det relevante mål; gæt ikke en bredde fra naboklassen.

**Anbefalet første beregningsslice:** finite klasser. Yderklasse-understøttelse kan udvides særskilt. Nulcount-yderklasser må ikke bidrage til midpointmomenter, men de skal stadig valideres og bevares i datagrundlaget. En fremtidig lokal quantileberegning kan overvejes, når målklassen er finite trods åbne yderklasser; det er en eksplicit capabilitybeslutning, ikke automatisk generel støtte.

## 5. Hyppigheder, histogramgrundlag og sumkurver

For klasser i numerisk rækkefølge: N=Σh, f_j=h_j/N, H_j=Σ(i≤j)h_i, F_j=H_j/N. Disse er **faktiske eksakte fakta om den oplyste klassificering**, ikke midpoint-estimater. Nulklasser bevares med f=0 og gentaget kumuleret værdi. Omkostninger afhænger af klasser/count-bitlængder, aldrig en ekspansion til N rå observationer.

Ved ulige finite bredder skal histogramhøjder deklareres som enten **hyppighedstæthed** h_j/w_j eller **frekvenstæthed** f_j/w_j. Arealet giver henholdsvis h_j og f_j; almindelig hyppighed som højde giver forkert arealbetydning ved ulige bredder. Density er her en eksakt skalering af kendte klassefakta; brug som model for den ukendte fordeling inde i klassen er en yderligere antagelse.

Reference R1: danske klasser `]0;10]`, `]10;20]`, `]20;40]`, counts [2,3,5], N=10:

| Klasse | w | h | f | H | F | h/w | f/w |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `]0;10]` | 10 | 2 | 1/5 | 2 | 1/5 | 1/5 | 1/50 |
| `]10;20]` | 10 | 3 | 3/10 | 5 | 1/2 | 3/10 | 3/100 |
| `]20;40]` | 20 | 5 | 1/2 | 10 | 1 | 1/4 | 1/40 |

Sumkurvens relative grænsepunkter er (0,0), (10,1/5), (20,1/2), (40,1); absolut er de (0,0), (10,2), (20,5), (40,10). For standarden med udelukket 0 er F(0)=0. De højrelukkede øvre grænser bærer eksakte kumulerede `antal(x≤upper)`-fakta, forudsat den erklærede partition dækker datasættet. Linjestykker mellem punkterne er **interpolationsmodellen**, ikke kendte rå observationer.

Hvis første klasse i stedet er `[0;10]`, kan antallet af observationer præcis ved 0 ikke udledes af dens samlede count. Da er startpunktet (0,0) en kontinuerlig models randværdi, **ikke nødvendigvis den faktiske empiriske F(0)**. Dette skal fremgå af den senere datapunkt-/estimatkontrakt. Ingen grafik implementeres her.

## 6. To slags eksakthed og estimater gennem arkitekturen

**Arithmetic exactness:** Fx 41/2 er beregnet præcist uden flydetalsafrunding. **Knowledge/estimand status:** Tallet kan samtidig være et estimat af en ukendt faktisk middelværdi. En eksakt rational beregning, en approksimativ numerisk evaluering og usikkerhed om de oprindelige observationer er forskellige akser.

Et fremtidigt estimeret mål bør derfor mindst have navngivne felter svarende til:

```text
{ value: ExpressionValue,
  arithmetic: "exact" | "approximate",
  status: "known-from-input" | "estimate",
  estimand: <fx empirical-mean eller within-class-model-quantile>,
  dataBasis: "interval-grouped",
  methodId: <versioneret metode>,
  assumptions: <versionerede matematiske antagelser> }
```

Dette er ikke gyldige ekstra felter på dagens ExpressionValue. Prober mod den faktiske kode afviste både et ekstra `estimate`-felt på Value og ekstra metadata på P0010-success. DocumentRuntime validerer success-Values og publicerer deres `value`; en løs backend-sidecar er ikke en implementeret proveniensvej. FROZEN §25's konceptuelle `metadata?` tilsidesætter ikke P0010's konkrete kontrakt.

| Alternativ | Fordel | Problem / anbefaling |
| --- | --- | --- |
| Fremtidig `StatisticsValue` med navngiven basis, metode og mål | Basis/estimatstatus følger immutable Value gennem P0010 og runtime; S99's tilsigtede retning | Kræver konkret P0005-kontrakt, versionering og tests. **Anbefales som første rige resultat**, uden implicit scalar-unwrapping |
| Separat fremtidig typed grouped-basis og estimate-scalar | Stærk sondring mellem datasæt og beregnet størrelse; kan muliggøre aritmetisk propagation | Flere typer/operationer; beslut aritmetik, equality og provenance før implementering |
| Eksplicit grouped-operation med ListValue af SetValue-intervaller + counts | Eksisterende transport kan bære input; eksplicit operation kan give klasserollen uden at ændre SetValue | Produceren skal validere partitionen. Bare ExpressionValue-output mister estimatstatus; løser ikke resultat-/aritmetikgaten |
| Metadata kun på calculation/outcome eller UI | Ser lille ud | Ikke understøttet som fri P0010-sidecar, når ikke med downstream Value; **frarådes som semantisk løsning** |
| Encode estimeret mål som `approx` | Kan give et ≈-tegn | Forveksler numerisk approksimation med datagrundlag; mister eksakt rational beregning. **Frarådes** |

Ingen `ListValue` af almindelige navngivne JS-objekter er en genvej: elementerne skal allerede være gyldige Values. Et typed gruppedatasæt kan på sigt ligge i en StatisticsValue med navngivne klasserecords; et matematisk interval kan være et eksplicit konstruktionsinput, men er ikke af den grund en statistisk klasse.

**Aritmetikgate:** `estimatedMean + 1` må ikke automatisk blive en umærket »kendt« ExpressionValue. Anbefal først et rigt resultat uden implicit almindelig aritmetik; derefter en separat beslutning om typed estimate-aritmetik med vedvarende status/metode/antagelser. En eksplicit numerisk projektion skal deklarere eventuelt tab af provenance og må ikke indføres som skjult evaluatorfallback. Propagation er ikke automatisk beregning af fejlmarginer eller antagelse om uafhængighed.

Basis/metode/estimand/status påvirker matematisk betydning og må ikke rubriceres som pynt, der frit kan slettes ved equality, transport eller caching. UI-locale og formattering er præsentation. Den konkrete equality- og extraction-kontrakt for nye typer er åben. DocumentRuntime skal fortsat kun eje ét dokument og publicere aktuelle afledte Values under eksisterende revisions-/generationsværn; ingen ekstra persistent statistikmotor.

## 7. Midpoint-middelværdi og spredning

Anbefalet første momentmetode **`midpoint-moments/v1`** (foreslået id): For finite positive bredder sættes m_j=(L_j+U_j)/2. Beregn mean_hat=Σh_jm_j/N, population_variance_hat=Σh_j(m_j−mean_hat)²/N og sample_variance_hat med N−1, når N≥2. Standardafvigelser er de eksakte ikke-negative kvadratrødder. Alle mål mærkes som estimater for det oprindelige observationsdatasæt; sample-navnet lover ikke unbiasedness efter gruppering.

Den fælles vægtede **aritmetik** kan genbruges, men gruppedatagrundlaget og estimatstatus må ikke forsvinde ved at sende midtpunkter gennem en public diskret observationsoperation. Positive counts på en ubegrænset klasse giver ingen midpoint; kræv information/anden eksplicit metode. N=1 giver imputeret midpointvarians 0; også den faktiske empiriske populationsvarians er da 0 af definition, selv om observationsværdien/middelværdien er ukendt. Det er en matematisk identitet, ikke en påstand om uniform-modelvariansen. En fremtidig statuskontrakt bør kunne skelne sådanne beviseligt kendte specialtilfælde fra generelle estimater. Sample-spredning afvises som før ved N<2.

R1 har midtpunkter [5,15,30]. Midpoint-resultaterne er mean_hat=**41/2**, population_variance_hat=**409/4**, population_std_hat=**sqrt(409)/2**, sample_variance_hat=**2045/18** og sample_std_hat=**sqrt(4090)/6**. Alle er eksakte beregninger på repræsentative punkter, ikke præcist kendte størrelser fra de oprindelige data.

En anden model, der antager en **kontinuert uniform fordeling inden i hver klasse**, har desuden within-class-varians w_j²/12. Dens blandingsfordelings populationsvarians er midpoint-variansen + Σh_jw_j²/(12N), i R1 **1477/12**. Det er et andet estimand/en anden model end midpoint-imputation og heller ikke automatisk den empiriske stikprøvevarians. Dette led må ikke stiltiende tilføjes, og sample-korrektion må ikke vælges uden en eksplicit model-/estimandkontrakt.

Eksempel R2: én klasse `]0;10]` med count 100 giver midpointvarians 0; den faktiske rå varians er ikke fastlagt. Uniform-modelvariansen er 25/3. De forskellige tal forklarer, hvorfor »matematisk eksakt« ikke betyder »faktisk kendt fra data«.

## 8. Median/kvartiler — to eksplicitte metodeforslag

### A. Invers af stykkevis lineær kumuleret frekvens — anbefalet til grouped/sumkurve

Foreslået metode-id **`piecewise-uniform-cdf/v1`**. For p i {1/4,1/2,3/4} sættes t=pN. Vælg den **første positive** klasse med H_j≥t og anvend:

`Q_hat(p) = L_j + w_j · (t−H_(j−1)) / h_j`.

Antagelsen er konstant modeltæthed inden for den valgte finite klasse. Dette estimerer en quantile af den stykkevis-uniforme model; det er ikke en eksakt rekonstruktion af rå rækkefølgestatistik. Alle grænser/counts/t beregnes eksakt. Ved t=H_j returneres U_j, altså den venstre klasses højre grænse. Det er konsistent med den danske tilhørsregel og inversen af den foreslåede sumkurve.

Nulklasser må aldrig vælges som divisor. Ved et plateau vælges den venstre ende af plateauet, dvs. første positive klasses krydsning ved den relevante kumulerede værdi. Eksempel R3: klasser `]0;10]`, `]10;20]`, `]20;40]`, counts [2,0,2] giver medianestimat 10, ikke 20 eller 0/0. Den flade strækning er bevaret i modellen. p=0/1 skal **ikke** genbruges som faktisk min/max; de mål kræver særskilt viden. En ubegrænset målklasse giver utilstrækkelig-information, ikke et gættet estimat.

R1 giver **[35/3,20,30]**. Medianen lander præcis på den kumulerede grænse mellem anden og tredje klasse. Lukningsflag er stadig afgørende for faktisk klassificering, selv om en kontinuert uniform model ikke har punktmasse ved endepunkterne.

### B. Interpolerede rangværdier med H's median-of-halves

Foreslået alternativ **`uniform-order-rank-halves/v1`**. Bevar H's valg af én/tovejs centrale rangplaceringer og halvdele. For en 1-baseret rang r i klasse j, hvor H_(j−1)<r≤H_j, er den lokale rang k=r−H_(j−1). Under en betinget iid-uniform-model for de h_j observationer i klassen estimeres den ordnede værdi som:

`O_hat(r) = L_j + w_j · k/(h_j+1)`.

Disse estimerede rangværdier kombineres med **præcis H's** median-/halvdel-/singletonregel. Metoden retter sig mod estimerede empiriske H-medianer/kvartiler, ikke direkte mod A's modelquantiler. Antagelsen om uniforme observationer inden for klassen er ekstra matematisk information, ikke noget counts alene beviser. Der kræves ingen ekspansion; kun få kumulerede rangopslag.

R1, N=10: Q1 bruger rang 3 →25/2; Q2 gennemsnitsdanner rang 5 og 6 →245/12; Q3 bruger rang 8 →30. Altså **[25/2,245/12,30]**, forskelligt fra A. Valget er en reel metode-/estimandbeslutning.

### Små datasæt og anbefaling

R4: én observation i `]0;10]`. A giver [5/2,5,15/2] som **modelquantiler**. B giver [5,5,5], fordi samme ukendte observation erstattes af sit midpoint og H's singletonregel gentager den. Ingen af delene er den kendte rå observationsværdi; faktisk x kan være ethvert tilladt punkt i klassen. H's besluttede `[x,x,x]` for kendt diskret x er uændret.

**USER-ACCEPTED efter analysen:** A er nu valgt som standard, inklusive grouped N=1-adfærd, kumuleret grænse og venstre plateauende; se beslutningsaddendum. B bevares ovenfor som analyseret alternativ, ikke som valgt standard. Metode/estimand/modelstatus skal fortsat bæres eksplicit. H's rå konvention ændres ikke; dokumentprofil og Value-/transportkontrakt afventer fortsat godkendelse.

## 9. Faktiske ekstremværdier og foreslåede diagnoser

Ingen af finite klassegrænser, midtpunkter eller interpolation giver normalt faktisk observeret min/max. Første/sidste klasse med positiv count fortæller alene, i hvilket interval ekstremværdien ligger. For R1: min ligger i `]0;10]`, max i `]20;40]`; det er ikke påstanden min=0 og max=40. Femtalsresumé som **faktisk** [min,Q1,Q2,Q3,max] kan derfor ikke leveres ved at indsætte klassegrænser. En eventuel model-femtalsvisning skal hedde/markeres som modelmål og have sin egen kontrakt.

Fremtidig præsentation kan forklare dette på dansk, men backend skal kun levere stabile facts. Forslag til en **endnu ikke registreret** producentkontrakt:

```text
code: "insufficient-statistical-information"
parameters: {
  operationId: "min",
  dataBasis: "interval-grouped",
  requestedQuantity: "observed-minimum",
  missingFact: "within-class-observations"
}
```

`max` bruger `observed-maximum`; et uberegnet midpoint/quantile i en åben klasse kan bruge passende requestedQuantity og missingFact `finite-class-bounds`. Forslagene skal få en eksplicit DiagnosticSpec og tests, før de bruges. P0009's åbne transport er ikke i sig selv en vedtaget producentkontrakt.

Domænefejl kan genbruge `type-mismatch`/`dimension-mismatch` med konkrete producerdescriptors. Klasse-layout kræver desuden et foreslået `invalid-class-layout` med stabile `reason`-enumværdier, fx `nonpositive-width`, `overlap`, `gap`, `ambiguous-shared-boundary`, og nulbaserede `classIndices`. Codes/parametre er forslag i dette dokument; **ingen tilføjes til kodebasens diagnoser i L**. Index og exact bound-Values kan bære facts; ingen lokaliseret besked eller Python-traceback må blive matematisk output.

## 10. Anbefalede beslutninger og åbne gates

| Emne | Anbefaling | Status før næste implementering |
| --- | --- | --- |
| Dansk lukning | Venstreåben/højrelukket dokumentstandard med eksplicitte flag | Retning fastlagt af brugeren; dokument-/persistensintegration skal besluttes |
| Første nedre punkt | Standardeksemplet ekskluderer 0; inklusion kræver eksplicit første-klasse-flag | Ingen skjult undtagelse; godkend konkret konstruktor-/profilpolitik |
| Klassemodel | Navngivne records, eksakte grænser/counts, sammenhængende ikke-overlappende partition, nulklasser bevaret | Konkret fremtidig P0005-/inputkontrakt og versionsvurdering kræves |
| Resultater | Rig StatisticsValue før automatisk scalar-aritmetik; dataBasis/metode/estimand/status følger Value | P0005/equality/extraction/arithmetikgate; ingen implementering her |
| Momentmetode | Midpoint-estimater med n og separat n−1; ingen skjult within-class-varians | Godkend metode-id og målbetydning |
| Grupperede kvartiler | **USER-ACCEPTED:** A `piecewise-uniform-cdf/v1`, inklusive grouped N=1 og plateau-regler | Matematik besluttet; typed resultattransport og konkret implementering afventer kontraktgate |
| Yderklasser | Først finite beregninger; ingen gættede midtpunkter eller bredder | Afgræns capabilities, utilstrækkelig-information og evt. lokale quantiler |
| Huller/overlap | Afvis i første version; kendt tomt interval repræsenteres med nulcount | Godkend validator-/producentschema før kode |
| Ekstremværdier | Struktureret afvisning af faktisk min/max/femtalsresumé uden fakta | Godkend diagnoseproducent; senere særskilt klassegrænse-/intervaloperation muligt |

## 11. Forslag til implementeringsslices og kommende RED-prøver

1. **Datakontrakt og dansk konvention:** Vedtag en versioneret grouped-basis/resultatkontrakt og navnene på dens konstruktion; test flags/eksakte grænser/counts, validering og Worker-roundtrip. Eksplicitte SetValue-inputs må kun få klasserollen gennem denne konstruktion. Ingen parsernotation vælges indirekte.
2. **Dokumentbinding:** Vedtag dokument-/opgaveprofil og persistensmigrering, hvis defaults skal påvirke kildens betydning. Test uændret semantik ved UI-sprogskift, `[0;10]`-undtagelsens stabilitet, historiske metode-id'er, autoritativ konventionsændring/invalidering og ADR-0005-snapshots. Ingen localStorage-default som erstatning.
3. **Kun eksakte klassefakta:** Frekvenser, kumulerede værdier, finite bredder og density-/sumkurvedata med eksplicit skelnen mellem kendte grænsepunkter og interpolerede segmenter. R1, nulklasse, ulige bredder og store counts er RED-referencecases; stadig ingen grafik.
4. **Midpoint-estimater:** Mean/variance/std med godkendt metode, estimatstatus og typed transport. Test R1/R2, sample-total<2, åbne yderklasser og propagation/afvisning ved aritmetik efter den vedtagne kontrakt.
5. **Grupperet quantilemetode:** Implementér den nu brugeraccepterede metode A efter Value-/transportgaten, ikke B som en skjult alternativ default. R1/R3/R4, præcis kumuleret grænse, nulclasser, n=1/2/3, rationals og store counts/rangplaceringer; actual min/max må fortsat fejle struktureret. Kør relevante rå/diskrete regressioner.

Alle fremtidige slices skal have egne RED→GREEN-beviser, korrekt providerbinding/genberegning, virkelig Worker/Pyodide-accept og afgrænset Git-diff. Parser, grafik/Plotly, renderer, Excel, student-release og nye frontend-flows er ikke en del af denne analyse.

## 12. Hvad der faktisk er verificeret i L

Der er udført read-only kontrakt-/kodegennemgang og ad hoc-prober af eksisterende interval-/Value-/P0010-grænser. De konkrete rationals i R1 og metode A/B er kontrolleret med desktop SymPy: mean=41/2, variance=409/4, sample=2045/18, modelvariance=1477/12, A=[35/3,20,30], B=[25/2,245/12,30]. Det verificerer dokumentets regneeksempler; **det er ikke implementerede grouped-operationer eller en grouped GREEN-suite**.

Ingen kunstige L-testtal, ny produktionskode, parserændring, ny Value-kind eller registreret diagnose. K's fulde suite/browserbeviser findes særskilt i `P0021-slice-100k-exact-frequency-table-projections.md`. Åbne gates ovenfor er leverancen til beslutning, ikke et uafsluttet forsøg på at implementere uafklaret matematik.
