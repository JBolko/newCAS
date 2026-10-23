# S100m — stabil StatisticsValue-kontrakt og eksplicit Value v2

**Status: historisk S100m-analyse. Repræsentationskontrakten er USER-ACCEPTED 23. oktober 2026 og registreret i [P0005 Value v2-tillægget](P0005-value-v2-statistics-contract.md) og ADR-0008.** De oprindelige PROPOSED/OPEN-markeringer nedenfor bevarer gennemgangshistorikken; nye matematiske producenter er fortsat ikke accepteret eller implementeret. Den generelle ressourcepolitik er efterfølgende USER-ACCEPTED og registreret i tillæggets §5.
22. oktober 2026. Kontrolleret basis: `architecture-v1-implementation`, HEAD `462deb0381ea5b624cd9ad41ceb06dd4069fcc58`.

**USER-ACCEPTED:** Arkitektur A med én StatisticsValue og to disjunkte varianter; eksplicit Value v2 ved siden af uændret v1; metadata inde i Value. Dansk venstreåben/højrelukket klassekonvention og `piecewise-uniform-cdf/v1` er matematisk accepteret. Det præcise schema, nesting, producentkontrakter og diagnoseforslag nedenfor er fortsat **PROPOSED**. [ADR-0008](../adr/ADR-0008-value-v2-statistics-encoding.md) er ligeledes et udkast. Ingen FROZEN-kontrakt ændres her.

## 1. Nødvendige præciseringer

Det tidligere forslag bandt selve encodingen til median/kvartiler, rationale resultater, én metode og model-estimatstatus. Symbolsk standardafvigelse, approksimation og afledte estimater ville dermed kræve schemaændringer. Det erstattes her af:

- Et almindeligt, fuldt valideret eksisterende typed Value som resultatpayload; ingen ny taltype.
- Åbne, syntaktisk afgrænsede metode-/estimand-id'er med eksplicitte, versionerede producent-/forbrugerkontrakter uden for Value-codec.
- To uafhængige statusakser: beregningsmæssig eksakthed og statistisk estimatstatus.
- En lukket proveniensstruktur med navngivne, materialiserede Value-inputs. Den kan indeholde tidligere resultater og dermed bevare hele afledningen uden dokumentreferencer.
- En generel v2-listenestingregel. En listes gyldighed afhænger ikke af, om netop ét af dens aktuelle elementer kræver v2.

Dette udvider forslaget, ikke eksisterende v1 eller de allerede accepterede matematiske metoder.

## 2. Versionsdispatch og rekursiv nesting

`ValueV1` betyder hele den eksisterende P0005-v1-kontrakt og encoding, inklusive dens rekursive v1-only-regel. Den genfortolkes ikke. Den nye union er:

```text
Value   := ValueV1 | StatisticsV2 | ListV2
ListV2  := {valueVersion:2, kind:"list", data:{items:[Value, ...]}}
Stats(d):= {valueVersion:2, kind:"statistics", data:d}
```

ListV2's array må være tomt, rent v1, rent v2 eller blandet og rekursivt nested. Ingen ekstra felter. Dette er én generel typed samlingsregel, også for fremtidige operationer; ikke en undtagelse for browsertestens `list`. V1-lister, -captures, -quantity osv. må fortsat **aldrig** have v2-descendenter.

Eksisterende konstruktører beholder v1-output for v1-inputs. Foreslået versionsvalg for den eksisterende selected `list`: v1 når alle direkte børn er v1, ellers v2. Den separate eksplicitte v2-factory/decoder accepterer også tomme og rent v1-lister. Gyldighed må ikke afhænge af dette minimale producentvalg; decode nedgraderer aldrig en deklareret v2-liste. Nested v2 gør også den ydre selected liste v2.

Andre v2-kinds end `statistics` og `list` er ikke del af dette forslag. Der foreslås ingen ændring af v1-konstanten `VALUE_VERSION=1` eller automatisk ommærkning af gamle Values. En v2-liste bliver aldrig implicit VectorValue/MatrixValue.

Ukendt encoding-version, kind/version-par eller statistikvariant afvises struktureret. En **ukendt metode er derimod ikke en ukendt encoding**: dens strukturelt gyldige resultat kan bevares som data, men ikke anvendes matematisk som en kendt metode; se §4.

## 3. Konkret schema

### Fælles strukturelle regler

Alle viste recordfelter er obligatoriske og udtømmende. V2 kræver rene JSON-datarecords: ingen ekstra/hidden/symbol/accessor-felter, sparse arrays, cycles, callbacks eller backendobjekter. Egen-properties inspiceres uden at udføre getters. Shared acyclic input må kopieres til et træ. Konstruktion/decoding laver detached, dybt immutable Values; Python anvender egne kopier uden at mutere input. Eksisterende top-level v1-adfærd bevares.

Der indføres **ingen intern schemaVersion**. `valueVersion:2` fastlægger begge variantformer og ListV2. Et ekstra schemaVersion-felt er ugyldigt. Metodeversion er matematisk identitet, ikke en skjult payloadversion.

Genbrugte typer:

| Type | Præcis struktur |
| --- | --- |
| `Id` | ASCII-streng, regex `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`. Ingen locale-/UI-tekst. |
| `VersionedId` | `Id` efterfulgt af `/v[1-9][0-9]*`. Hele id'et er opakt; ingen Number-konvertering af versionsdelen. |
| `ExactBoundaryV1` | Eksisterende v1-ExpressionValue med integer- eller rational-leaf; v1's streng-/nævnerregler. Ingen approx, symbol, infinity eller Quantity i denne klasseform. |
| `CountV1` | V1-ExpressionValue med integer-leaf, hvis value matcher `0|[1-9][0-9]*`. Counts er strenge, også over 2^53. |
| `Class` | Præcis `{lower:ExactBoundaryV1,upper:ExactBoundaryV1,lowerClosed:boolean,upperClosed:boolean,count:CountV1}`. |
| `ResultPayload` | Et fuldt gyldigt `ValueV1`, ikke en rå JSON-værdi og ikke en StatisticsValue eller ListV2. |
| `Input` | Præcis `{role:Id,value:Value}`. Roller er unikke inden for den aktuelle inputs-liste. |
| `Provenance` | Præcis `{inputs:[Input,...]}`; ikke-tom, ordnet liste af komplette snapshots. |

ResultPayload genbruger den eksisterende lukkede, rekursive v1-grammatik for expression/function/relation/set/list/vector/matrix/quantity. Det giver typed scalar, liste, vektor, kovariansmatrix, enhedsresultat og senere funktions-/mængderesultater uden en vilkårlig payload-pose. Det **tillader ikke**, at enhver metode returnerer enhver type: dens registrerede outputkontrakt skal fastlægge den præcise subtype, form og domæne. Første numeriske metoder bruger kun ExpressionValue eller ListValue af ExpressionValues.

Statistikwrappere hører i provenance eller almindelige ListV2-samlinger, ikke skjult i resultatpayloaden. Derved har ét statistical-result én eksplicit resultatbetydning/status; en samling af selvstændige statistiske resultater beholder hver sin wrapper. V1-funktionscaptures udvides ikke indirekte.

Repræsentation af kendte mål ændrer ikke eksisterende mean/variance/standard_deviation-producenters bare v1-output. En senere rig resultatproducent kræver sin egen eksplicitte kontrakt; ingen gammel operation ommærkes automatisk.

### grouped-data

```text
Stats({
  variant: "grouped-data",
  basisKind: "interval-grouped",
  classes: [Class, ...]                   // ikke-tom; klasseorden bevares
})
```

Præcis disse tre felter. Nulhyppighedsklasser bevares sammen med deres grænser og flag. Ingen gemt total, bredde, midpoint, kumuleret count, validated-markør, dokument-id eller backendhandle. Class er ikke et SetValue; intet automatisk medlemskab eller konvertering arves fra en mængde.

Første repræsenterede klassedomæne er finite, enhedsløse rationale grænser og absolutte counts. En public producent skal senere få sin matematiske domænekontrakt accepteret (§6). Nul total og ugyldig partition er ikke JSON-shape-fejl.

### statistical-result

```text
Stats({
  variant: "statistical-result",
  statisticId: Id,
  methodId: VersionedId,
  estimand: VersionedId,
  arithmetic: "exact" | "approximate",
  estimateStatus: "known" | "estimated",
  assumptions: [VersionedId, ...],         // må være tom; ingen dubletter
  provenance: {inputs: [Input, ...]},
  value: ResultPayload
})
```

Præcis disse ni felter. Ingen lukket liste over median/kvartiler/mean/variance i encodingen. Heller ingen frie metadata-, parameters- eller backend-options-records.

- `statisticId` identificerer målet, ikke P0008-dispatch. `methodId` identificerer den uforanderlige matematiske algoritmeversion. `estimand` identificerer den versionerede størrelse, der faktisk beregnes/estimeres, inklusive relevante populations-/modelvalg.
- `arithmetic:"exact"` betyder beregningsmæssigt eksakt for den deklarerede størrelse/model. Symbolsk `sqrt(409)/2` kan være exact; exact betyder ikke rational. `approximate` angiver numerisk approksimation; eksisterende approx-blade bærer værdi og eventuel precisionBits. Der oprettes ikke en ny float-/taltype.
- `estimateStatus:"known"` betyder bestemt af det oplyste datagrundlag for det **deklarerede estimand**, ikke sikker viden om en ukendt population. `estimated` dækker model- og andre statistiske estimater; den konkrete karakter findes i metode, estimand og antagelser.
- `assumptions` indeholder versionsbestemte matematiske antagelses-id'er. Et tomt array beviser ikke known. Registrerede metoder bestemmer krævede og tilladte antagelser og deres propagation.
- `provenance.inputs` indeholder de faktisk anvendte materialiserede data/forgængerresultater og alle betydningsbærende parametre som typed Values. Roller og arrayorden er metodekontraktens. Ingen fremtidige provideropslag eller reference til aktuel dokumentdefault.

For et direkte grupperet resultat er input fx `{role:"data",value:<grouped-data snapshot>}`. For rå kendte statistiske størrelser kan det være en v1-liste; for en transformation et tidligere statistical-result og en typed scalarparameter. Der kræves ikke et fiktivt grouped-data-grundlag for alle resultater.

Alle fire kombinationer er meningsfulde: exact/known fx et råt empirisk gennemsnit; approximate/known en numerisk approksimation af samme størrelse; exact/estimated fx modelkvartiler eller en eksakt modelstandardafvigelse; approximate/estimated en numerisk approksimation af et modelmål. Ingen af statusfelterne udledes alene af den anden akse.

## 4. Metodekontrakter og proveniens ved transformationer

**Codecens ansvar stopper ved strukturel gyldighed.** Id'er er syntaktisk kontrollerede, men et regex-match er ikke en matematisk godkendelse. Der foreslås et statisk, eksplicit register af versionsbestemte producent-/forbrugerkontrakter ved den eksisterende Python-evaluator; ikke et nyt runtime-plugin eller en ny dispatchvej.

Hver understøttet metodekontrakt skal fastlægge:

1. Tilladte statisticId/estimand, præcise inputroller og parameter-Values, antal/orden og matematisk domæne.
2. Præcis output-kind/form og betydning; fx tre numeriske blade i [Q1,Q2,Q3], ikke blot en vilkårlig ListValue.
3. Arithmetics krav, estimateStatus, obligatoriske/tilladte antagelser og propagation fra inputs.
4. Autoritativ matematisk validering, herunder numerisk realitet, partition og eventuelle nonnegative rødder.
5. Eksplicit selected OperationSpec/evaluator-tilknytning og P0009-producentdiagnoser samt testfixtures.

Nye metoder skal registreres og testes før udførelse. P0008 vælger fortsat operation/evaluator **før** kaldet; metadata kan ikke udpege en ny evaluator, hente kode eller starte automatisk replay. Ingen overload med samme aritet udvælges skjult efter Value-kind. Samme metode-id kan have flere eksplicit deklarerede statistiske mål, hvis deres kontrakter er entydige.

Konkret første **PROPOSED producentbinding**, ikke enum i encodingen: methodId `piecewise-uniform-cdf/v1` accepterer inputrollen `data` med én matematisk valideret grouped-data. statisticId `median` bruger estimand `within-class-model-median/v1` og én rational ExpressionValue; `quartiles` bruger `within-class-model-quartiles/v1` og en v1-liste med præcis tre rationale ExpressionValues. Begge kræver exact/estimated og præcis antagelsen `uniform-within-class/v1`. Forkert listeform, estimand eller claimed known-status er producent-/forbrugerfejl, selv om recorden er strukturelt gyldig. Flere bindings tilføjes eksplicit uden schemaændring.

**Ukendte, men strukturelt gyldige metoder/estimander/antagelser:** Decode, encode, opaque listekopiering, immutable lagring og repræsentationssammenligning må bevare dem uden at tillægge dem kendt matematisk betydning. Matematisk brug kræver en kendt forbrugerkontrakt; ingen scalarprojektion, beregning, default-substitution eller inference fra navnet. En ukendt metodeversion i en nødvendig forgænger afvises tilsvarende. Dette skel gør udvidelse mulig inden for v2 uden lydløs semantisk accept.

**Afledte estimater:** En senere eksplicit transformation gemmer det komplette tidligere resultat under fx inputrollen `operand` og konstanten under `offset`. Det nye resultat har egen methodId/estimand og beregnet typed payload; det gamle resultat, dets basis og alle tidligere metodevalg bevares rekursivt. Ingen flad omskrivning til blot det oprindelige datasæt, ingen hash som eneste repræsentation og ingen eksterne objekt-/dokumentreferencer.

Producentkontrakten skal bevare relevante antagelser og estimatstatus. Generisk `estimated -> known` eller `approximate -> exact` er ikke tilladt; en eventuel matematisk begrundet undtagelse kræver særskilt accepteret producentregel. Der implementeres ingen transformation/estimat-aritmetik nu. Proveniens er data, ikke en eksekverbar beregningsplan eller et kryptografisk korrekthedsbevis; decode og historisk åbning genberegner ikke kæden.

## 5. Canonical encoding, immutability og lighed

V1-factories, decode/encode og bytes ved uændret v1-repræsentation bevares. Ingen global key-sortering, gcd eller rationalnormalisering tilføjes til v1.

V2 serialiseres til kompakt JSON med følgende faste feltrækkefølge: envelope `valueVersion,kind,data`; grouped `variant,basisKind,classes`; Class `lower,upper,lowerClosed,upperClosed,count`; result som vist i §3; provenance `inputs`; Input `role,value`; list-data `items`. Assumptions er en mængde af id'er: dubletter afvises, og gyldige id'er ordnes leksikografisk ved konstruktion/decode/encode. Dette er strengkanonisering, ikke statistik.

Klasse-, resultatliste- og provenance-inputorden bevares. Embedded v1-subtrees bruger uændret eksisterende v1-encoding, inklusive dens repræsentations-/feltrækkefølge; der kræves ingen ny matematisk normalform. JS og Python skal have fælles bytefixtures, også for embedded v1. Python-producenter kan normalisere beregnede tal med den eksisterende SymPy-adapter.

Canonical v2 skal encode/decode-roundtrippe byteidentisk; øvrige gyldige v2-fieldordener kan rekonstrueres til denne form. Hele JS-resultatet fryses dybt efter detached konstruktion; genkendelse af v2 kræver samme immutable struktur. En decoder er ikke matematisk validering eller godkendelse af en ukendt metode.

**Repræsentationslighed** er lighed mellem de versionsbestemte encodings. Den omfatter variant, alle inputs/proveniens, klasseflag/counts/orden, metode, estimand, begge statusakser, antagelser og resultatpayload. Samme tal med anden metode/basis er forskellige StatisticsValues. En v1-liste og v2-liste er forskellige repræsentationer; dette afgør ikke matematisk ækvivalens. Ingen UI-locale, label, transient cache eller timestamp indgår.

## 6. Matematisk validering og kontrollerede afvisninger

JS kontrollerer schema, id-syntaks, eksisterende typed Values, CountV1's strengform, flag, unikke inputroller og arrays. JS beregner ikke total, grænsernes orden, bredder, overlap, kvantiler eller statuspropagation. FROZEN §14.1 skelner repræsenterbarhed og operabilitet.

**PROPOSED første Python/SymPy-domæne:** finite rationale klasser, lower<upper, N>0, sammenhængende partition uden overlap/dubletter/huller. Ved delt grænse skal præcis én nabo indeholde punktet. Valider også nulklasser; sorter hele klasserecords numerisk i en matematisk producent, bevar parringen og alle nulcounts. Ingen ekspansion til N observationer, ingen JS Number og intet validated-certifikat. Consumer validerer domænet før matematisk brug; transportens `list` attesterer ikke partitionen. En senere public konstruktør og disse domæneregler kræver særskilt accept.

**USER-ACCEPTED metodekontraktens matematik:** `piecewise-uniform-cdf/v1` bruger jævn fordeling inden for hver klasse og invers interpolation ved p=1/4,1/2,3/4. Første positive klasse som når pN vælges; nulklasser er ikke divisorer; ved plateau vælges venstre ende. Ukendte faktiske extrema må ikke erstattes af klassegrænser, og en ikke-endelig interpolationsbredde må ikke opdigtet udfyldes. Resultatet skal være estimated, også ved exact aritmetik. Gruppens singleton `]0;10]`/count 1 giver [5/2,5,15/2]; rå/discrete singletonregler ændres ikke.

Den foreslåede metodebinding i §4 kræver særskilt teknisk accept. Metode A er matematisk accepteret; midpoint-momentmetoden og grupperet standardafvigelse er **ikke** dermed accepterede algoritmer. Repræsentationsmulighed giver ingen implementeringstilladelse.

Danske dokumenters accepterede udgangspunkt er `]0;10]`, `]10;20]`, `]20;40]`, dvs. lowerClosed=false og upperClosed=true; en fælles grænse tilhører venstre klasse. Første `[0;10]` kan eksplicit have begge flag true, så 0 inkluderes. UI-sprogskift ændrer aldrig disse flag. En konkret versionsbestemt dokumentprofil, konstruktorsyntaks og persistens er fortsat gates; codec vælger ingen locale-default.

**PROPOSED P0009-producenter, endnu ikke registreret:**

| Code | Præcise parametre og anvendelse |
| --- | --- |
| `unsupported-value-encoding` | `{path,feature,actual,supported}`; path/actual strenge, supported strengliste; feature kun `value-version\|value-kind\|statistics-variant`. Ukendt metode er ikke denne fejl. |
| `invalid-value-encoding` | `{path,reason}`; reason én af `json-syntax,record-shape,field-set,version-shape,leaf-shape,variant-shape,nesting-version,mutable-value,non-json-data`. |
| `unsupported-statistical-method` | `{operationId,methodId,path}`, alle strenge; matematisk anvendelse af en ukendt/ikke understøttet metodeversion. |
| `invalid-statistical-result` | `{operationId,path,reason}`; reason én af `signature-mismatch,domain-mismatch,metadata-mismatch,provenance-mismatch` for kendt metode med brudt producent-/forbrugerkontrakt. |
| `invalid-class-layout` | `{operationId,reason,classIndices}`; reason én af `nonpositive-width,overlap,gap,ambiguous-shared-boundary`; indices er nulbaserede i modtaget array før sortering. |

Alle path/operationId er strenge; classIndices er en tæt liste af ikke-negative sikre indeksheltal. Paths er stabile slash-stier med arrayindeks, ikke fejltekst. Ugyldigt typede versionfelter er shape-fejl. Countværdier og numeriske data kopieres aldrig ind som vilkårlig exceptiontekst. Eksisterende `type-mismatch`/`unsupported-operation` bruges ved forkert operation/inputdomæne med deres faktiske producentschemaer. Total=0 kan bruge `type-mismatch` med `{operationId,argument:"data",expectedKinds:["positive-total-grouped-data"],actualKind:"statistics"}`.

Begge statistikvarianter afvises ved almindelig scalar-aritmetik; en liste af StatisticsValues bliver heller ikke implicit en liste af deres resultatpayloads. Nye diagnoser skal accepteres som almindelige P0009 DiagnosticSpecs, ikke parallelle envelopes. Codecfejl kan bruge en trusted `error.diagnostic` i eksisterende exceptionkanal; `isValue` er fortsat en boolean-genkender.

## 7. Versions- og udvidelsespolitik

| Ændring | Krav |
| --- | --- |
| Inkompatibel eksisterende field-shape, discriminatorbetydning, nestingregel eller encoding | Ny accepteret Value-encoding-version. Aldrig genbrug af v2 med ny betydning. |
| Ny statistikoperation/metode med repræsenterbare inputs/outputs | Ny eksplicit producent-/forbrugerregistrering, P0008-spec og tests; **ingen ny Value-version**. Samme methodId må ikke få ændret matematisk betydning; ny matematik får nyt metode-id/version. |
| Nyt matematisk domæne | Særskilt accepteret producentkontrakt og capability/tests. Ingen ny Value-version hvis schemaet allerede repræsenterer domænet. En ny datashape uden for schemaet, fx den endnu ikke repræsenterede ubegrænsede klassegrænse, er en separat encodinggate. |
| Nyt dokumentformat, dokumentprofil/default eller persistensregel | Særskilt fil-/languageVersion-/migrationsbeslutning. Hverken Value v2 eller ny metode ændrer automatisk dokumentformatet. |
| Ny UI-notation eller sprog | Præsentationskontrakt; må ikke ændre flag, metode, estimand eller eksisterende Values. |

Ingen dobbeltversionering af payload i første schema. En tilføjet metode kræver ikke, at gamle komponenter matematisk forstår den; nye decodere kan bevare dens data og forbrugere afvise den. Gamle v1-decodere kan ikke forventes at forstå nogen v2. Ukendte encodinger/varianter afvises, ikke gemmes i en utypet pose.

Eksempelvis kan mean, variance, eksakt symbolsk standardafvigelse, numerisk approksimation og en eksplicit estimattransformation tilføjes inden for dette schema. Det gælder ikke et løfte om alle fremtidige datamodeller. Nye metadatafelter til én operation må ikke være genvejen: betydningsbærende parametre er typed provenance-inputs under en accepteret metodekontrakt.

## 8. Seks konceptuelle stresstests

| Scenarie | Tidligere forslag | Stabiliseret forslag / næste handling |
| --- | --- | --- |
| A. Modelkvartiler [35/3,20,30] | Virkede uændret med den snævre metode og rational-liste. | V1-listpayload, exact/estimated, uniform-antagelse og grouped snapshot under inputrollen data. Almindelig eksplicit metodeproducent; ingen schemaændring. |
| B. Grupperet standardafvigelse sqrt(409)/2 | **Tvang schemaændring**: kun median/kvartiler og rationale blade. | Eksisterende v1-ExpressionValue med mul/pow, exact/estimated. Ny accepteret moment-/estimandkontrakt og operation; ingen ny encoding. Tallet er et midpoint-model-eksempel, ikke automatisk samme estimand som uniform-modelvarians. |
| C. Samme tal, forskellig basis eller metode | Virkede for de allerede tilladte baser/metoder; nye metoder var udelukket. | Sammenlign hele Value/provenance, ikke kun payload. Forskellige basis/methodId giver forskellige repræsentationer; ingen ny operation/schema påkrævet for ligheden. |
| D. Transformation af estimat | **Tvang schemaændring**: basis måtte kun være grouped-data; afledningen kunne ikke bevares. | Tidligere resultat plus typed parametre som inputs; egen registreret metode/estimand og eksplicit propagation. Almindelig ny operation/producentkontrakt, ingen schemaændring og ingen implicit unwrapping. |
| E. Counts >2^53, eksplicitte flag, nulklasser | Virkede uændret. | Bevares som strengblade og komplette klasserecords; Python validerer/beregner. Ingen ny schema- eller metodeversion alene på grund af datastørrelsen. |
| F. Gamle v1-dokumenter/Values | Virkede ved bevaret v1-closure. | V1 er fortsat uændret, også bytes og rekursion; ingen automatisk filopgradering. ADR-0005 bevarer historiske snapshots uden ny beregning. |

Også mean/variance og approximate/known eller approximate/estimated ville bryde det gamle resultatdomæne; alle kan nu repræsenteres med eksisterende v1-payloads og registrerede producenter. Ingen af A–F kræver en yderligere Value-version med det stabiliserede forslag.

## 9. Transport- og runtimegate i den faktiske kode

Kontrolleret mod HEAD og arbejdstræ, ikke blot roadmap:

| Led | Fund og afgrænset næste ændring |
| --- | --- |
| `src/js/values/value.js` | Lukket v1-kind/version samt rekursion. Tilføj separat dispatch og v2-codec; bevar alle v1-stier. |
| `src/js/evaluator/evaluation-contract.js` / P0010 | Bruger generisk isValue og frosne materialiserede inputs. Accepteret tillæg skal binde Value til v1/v2-unionen; request/outcome-version og præcise felter bevares. |
| `src/js/evaluation/worker-evaluation-protocol.js` | Requestcheck er primært routing/selection; response bruger decodeValue. Valider relevante input-/provider-Values ved begge afsendelses-/modtagelsesgrænser, ikke via vilkårlig options-søgning. Bevar correlation, epoch og supervision. |
| `src/python/evaluator/selected_gateway_bridge.py` | Mangler fuld Value-schema-validering. Brug fælles Python-codec på typed grænser; ingen statistikberegninger i gateway. |
| `src/python/evaluator/container_list.py` | Kræver/returnerer v1. Opgrader opaque kopiering til den aftalte union og producentens versionsvalg, ikke matematisk validering. |
| `src/python/adapters/sympy_value_adapter.py` | V1-ExpressionValue understøtter allerede pow/rationale og approx med precisionBits; bevar adapteren. En hel StatisticsValue bliver ikke til SymPy-scalar. |
| DocumentRuntime og readonly-view | Generisk Value-publicering, binding og freeze; ingen statistikslots, metadata-sidecar, providerregel eller ny dokumentautoritet. |

Trusted input-codecdiagnoser kan bruge eksisterende P0010-failurevej. Malformed/ukendt response-encoding bevarer eksisterende `INVALID_WORKER_VALUE` med dens nuværende nulparametre; ingen modstridende error.code/diagnostic.code og ingen delvis publicering. Arbitrære exceptions klassificeres ikke ved tekstmatch. Ukendt metode alene er ikke malformed transport.

## 10. Afgrænset S100m1 / S100m2 efter accept

**Fælles invariants:** Ingen parser, FROZEN/accepted ADR-ændring, ny evaluator, scalar-unwrapping eller runtime-specialcase. Eksisterende syv TODO/én SKIP bevares. Hver del begynder med kørte, fokuserede RED-tests, før produktionsændringer. Rollback er alene at tilbageføre delens egne udpegede ændringer efter review; aldrig reset/clean af brugerens arbejdstræ.

### S100m1 — repræsentation og codecs

**Filafgrænsning:** `src/js/values/value.js`, evt. privat `src/js/values/statistics-value.js`; ny `src/python/adapters/statistics_value_adapter.py` som strukturel codec, ikke SymPy-statistik; de accepterede codec-DiagnosticSpecs i `src/js/diagnostics/diagnostic.js`. Tests: `tests/js/p0005-statistics-value-contract.test.mjs`, `tests/python/test_statistics_value_adapter.py`, eksisterende `tests/js/value-contract.test.mjs` og fælles nye canonical fixtures i `tests/fixtures/statistics-value-v2.json`. Ingen gateway/runtime-/matematikændring i denne del.

**RED og accept:**

1. Begge varianter og tomme/rent-v1/blandede/rekursive ListV2; v2 i enhver v1-descendent afvises. Alle eksisterende v1-bytefixtures uændrede.
2. Strenge counts >2^53, nulklasser, eksplicitte flag og exact symbolsk sqrt(409)/2. Alle fire statuskombinationer strukturelt repræsenterbare. Manglende/ekstra felter, ulovlige flags, ukendte versioner/kinds/varianter, accessor/cycle/sparse afvises uden getters.
3. Ukendt velformet metode roundtripper opakt; ugyldigt id afvises. ResultPayload skal være fuld v1-Value; ingen v2-wrapper skjult i payload. Kendt/ukendt metode ændrer ikke codecens output.
4. Fuld provenienskæde, typed parametre, unikke roller og immutable detachment. Samme tal med ændret basis/metode/status er forskellige repræsentationer. JS/Python canonical bytes stemmer overens, inklusive embedded v1 og assumptions-normalisering.
5. Codec accepterer shape-valid lower>=upper/N=0 som repræsentation, men påstår ingen matematisk accept. Fokuseret JS/Python-regression og fuld npm; ingen Worker-GREEN påstås endnu.

### S100m2 — rigtig typed transport og dokumentpublicering

**Filafgrænsning:** Eksisterende `src/js/evaluation/worker-evaluation-protocol.js`, `selected-pyodide-runtime.js` i samme mappe (kun relevant Value-check/filallowlist), `src/python/evaluator/selected_gateway_bridge.py`, `container_list.py` og om nødvendigt kontrollerede v2-afvisningsgrænser i `list_statistics.py`. Genbrug m1-codec. Tests: eksisterende `evaluation-contract.test.mjs`, `p0021-worker-value-rehydration.test.mjs`, `p0021-worker-evaluation-protocol.test.mjs`, `test_p0021_selected_gateway_bridge.py`; nye `tests/browser/p0005-statistics-value-roundtrip.html` / `.mjs` og `tests/js/p0005-statistics-runtime-publication.test.mjs`. DocumentRuntime testes gennem eksisterende API, ændres ikke til statistikautoritet.

**RED og accept:**

1. Rigtig browser/module Worker/Pyodide/SymPy gennem eksisterende selected list: materialiseret grouped-data og resultater inkl. radikal, approx og afledt proveniens sendes ud/retur og genbruges som næste requests input. V1-only list-output forbliver v1; blandede/nested v2-børn giver v2. Dette er fixturetransport, ikke nye statistiske algoritmer.
2. Ukendt velformet metode kan transporteres uændret. Scalar-/gamle statistikoperationer afviser begge varianter kontrolleret; intet unwrap eller lookup/replay fra methodId. Malformed request/response og ukendte encodinger giver de accepterede strukturerede fejl uden publicering.
3. DocumentRuntime publicerer hele den immutable Value; korrekt providerbinding, task-isolation, invalidation og genberegning efter ændret materialiseret datakilde. Stale resultater afvises, og allerede publicerede snapshots ændres ikke.
4. Fokuserede Node/Python/Worker-regressioner, fuld npm med faktiske PASS/FAIL/TODO/SKIP, parser-sync og diff-check. Reel browsertransport er acceptance-gate; fake Worker alene er utilstrækkelig.

M1/m2 implementerer **ingen** matematisk grouped-konstruktion, kvantilalgoritme eller estimattransformation. Næste særskilte beregningsslice skal acceptere konkrete P0008-/metoderegister-/P0009-producentkontrakter og tilføje Python/SymPy-validering under den eksisterende evaluator, fx `src/python/evaluator/grouped_data_validation.py`. Dens RED skal dække lower>=upper, N=0, overlap/huller/delt grænse, nulklasser, store counts uden ekspansion samt metode A's reference-/plateau-/singletoncases. Profil/syntax/persistens og rendering er fortsat senere gates.

## 11. Anbefaling og åbne gates

**READY FOR ACCEPTANCE — som stabiliseret kontraktforslag.** A–F og de næste mean/variance/standardafvigelses-/approksimationsfunktioner kan rummes uden ny Value-version eller særregler i DocumentRuntime/P0010. Der er ikke fundet et nødvendigt brud på FROZEN's typed/stateless arkitektur. Dette er ikke produktions-GREEN eller normativ accept: implementeringen er fortsat gated af eksplicit accept af P0005-v2-tillægget og ADR-0008.

**Særskilt accept kræves nu:** de to schemaer inkl. generelt ResultPayload og provenance; statusbetydninger/metoderegistergrænse; ListV2-closure og producentvalg; canonical encoding/lighed/ingen intern schemaVersion; P0010's Value-union og codecdiagnoseproducenter. De konkrete matematiske producentkontrakter/diagnoser accepteres før deres senere implementering; godkendelse af en repræsentation godkender ikke midpointmodellen eller estimataritmetik.

**OPEN, ikke skjulte implementeringsbeslutninger:** public grouped-konstruktør og finite-partitionsdomæne, konkrete metodebindings-id'er/signaturer og forbrugervalidering; estimatpropagation pr. operation; yderklasser/andre datadomæner; dokumentprofil/persistens/historisk kompatibilitetsdeklaration; UI/rendering. De forhindrer ikke accept af den afgrænsede repræsentations-/transportkontrakt, men må ikke udfyldes stiltiende i m1/m2.

Grundlag: P0005/P0010, FROZEN §§14–15/25–26 og stress tests, review-resolution §§2.3/2.10/2.15, accepted ADR-0004/-0005/-0006 samt S100l-beslutningerne. ADR-0007 er fortsat Proposed. Kodeprober bekræfter JS-v1-encode/decode/deep freeze og den eksisterende SymPy-adapters tabsfri roundtrip af sqrt(409)/2 uden Float. Fokuserede eksisterende regressioner: Value/P0010/Worker-rehydrering **68 Node PASS**, SymPy-adapter **29 Python PASS**; 0 FAIL/TODO/SKIP. Det er **ikke** bevis for en implementeret StatisticsValue, ny metode eller rigtig v2-Workeraccept. Fuld npm og browseraccept er ikke kørt for dette dokumentationsarbejde.
