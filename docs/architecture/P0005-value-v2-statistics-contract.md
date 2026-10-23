# P0005 — Value v2 StatisticsValue-kontrakttillæg

**Status: ACCEPTED — repræsentationskontrakt; implementeringsaccept afventer S100m1/m2.**
**Acceptdato:** 23. oktober 2026. **Value-encoding:** 2. **Beslutning:** [ADR-0008](../adr/ADR-0008-value-v2-statistics-encoding.md).

Brugeren har eksplicit accepteret den stabiliserede S100m-repræsentation. Dette versionsbestemte tillæg bevarer [P0005 v1](P0005-value-contract-v1.md) fuldstændigt uændret og udvider ikke FROZEN-semantik. Det følgende er det accepterede schema, nesting, encoding, lighed, metadata og codecdiagnoser. [S100m-analysen](P0005-statistics-value-contract-proposal.md) bevares som baggrund, ikke som hjemmel til nye beregningsmetoder.

P0010's præcise envelopes og versionsnumre ændres ikke. Deres Value-binding skal i S100m2 opgraderes samlet med de virkelige transportgrænser; dette dokument påstår ingen allerede fungerende v2-Worker/gateway/publicering. S100m1 må kun implementere repræsentation og codecs.

## 1. Versionsdispatch og rekursiv nesting

`ValueV1` betyder hele den eksisterende P0005-v1-kontrakt og encoding, inklusive dens rekursive v1-only-regel. Den genfortolkes ikke. Den nye union er:

```text
Value   := ValueV1 | StatisticsV2 | ListV2
ListV2  := {valueVersion:2, kind:"list", data:{items:[Value, ...]}}
Stats(d):= {valueVersion:2, kind:"statistics", data:d}
```

ListV2's array må være tomt, rent v1, rent v2 eller blandet og rekursivt nested. Ingen ekstra felter. Dette er én generel typed samlingsregel, også for fremtidige operationer; ikke en undtagelse for browsertestens `list`. V1-lister, -captures, -quantity osv. må fortsat **aldrig** have v2-descendenter.

Eksisterende konstruktører beholder v1-output for v1-inputs. Accepteret producentvalg for den eksisterende selected `list`: v1 når alle direkte børn er v1, ellers v2. Den separate eksplicitte v2-factory/decoder accepterer også tomme og rent v1-lister. Gyldighed må ikke afhænge af dette minimale producentvalg; decode nedgraderer aldrig en deklareret v2-liste. Nested v2 gør også den ydre selected liste v2.

Andre v2-kinds end `statistics` og `list` er ikke del af dette tillæg. Der foreslås ingen ændring af v1-konstanten `VALUE_VERSION=1` eller automatisk ommærkning af gamle Values. En v2-liste bliver aldrig implicit VectorValue/MatrixValue.

Ukendt encoding-version, kind/version-par eller statistikvariant afvises struktureret. En **ukendt metode er derimod ikke en ukendt encoding**: dens strukturelt gyldige resultat kan bevares som data, men ikke anvendes matematisk som en kendt metode; se §4 nedenfor.

## 2. Konkret schema

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

Første repræsenterede klassedomæne er finite, enhedsløse rationale grænser og absolutte counts. En public producent skal senere få sin matematiske domænekontrakt accepteret særskilt. Nul total og ugyldig partition er ikke JSON-shape-fejl.

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

## 3. Canonical encoding, immutability og lighed

V1-factories, decode/encode og bytes ved uændret v1-repræsentation bevares. Ingen global key-sortering, gcd eller rationalnormalisering tilføjes til v1.

V2 serialiseres til kompakt JSON med følgende faste feltrækkefølge: envelope `valueVersion,kind,data`; grouped `variant,basisKind,classes`; Class `lower,upper,lowerClosed,upperClosed,count`; result som vist i §2; provenance `inputs`; Input `role,value`; list-data `items`. Assumptions er en mængde af id'er: dubletter afvises, og gyldige id'er ordnes leksikografisk ved konstruktion/decode/encode. Dette er strengkanonisering, ikke statistik.

Klasse-, resultatliste- og provenance-inputorden bevares. Embedded v1-subtrees bruger uændret eksisterende v1-encoding, inklusive dens repræsentations-/feltrækkefølge; der kræves ingen ny matematisk normalform. JS og Python skal have fælles bytefixtures, også for embedded v1. Python-producenter kan normalisere beregnede tal med den eksisterende SymPy-adapter.

Canonical v2 skal encode/decode-roundtrippe byteidentisk; øvrige gyldige v2-fieldordener kan rekonstrueres til denne form. Hele JS-resultatet fryses dybt efter detached konstruktion; genkendelse af v2 kræver samme immutable struktur. En decoder er ikke matematisk validering eller godkendelse af en ukendt metode.

**Repræsentationslighed** er lighed mellem de versionsbestemte encodings. Den omfatter variant, alle inputs/proveniens, klasseflag/counts/orden, metode, estimand, begge statusakser, antagelser og resultatpayload. Samme tal med anden metode/basis er forskellige StatisticsValues. En v1-liste og v2-liste er forskellige repræsentationer; dette afgør ikke matematisk ækvivalens. Ingen UI-locale, label, transient cache eller timestamp indgår.

## 4. Opak metodeidentitet og matematisk afgrænsning

Metode-/estimand-/antagelses-id'er valideres syntaktisk af codec. Ukendte velformede id'er kan roundtrippe og lagres opakt. De må aldrig starte dispatch, replay, scalar-unwrapping eller fortolkes som kendt matematik. P0008 vælger operation/evaluator eksplicit. Hver senere matematisk producent/forbruger kræver en accepteret versioneret kontrakt for inputroller, outputform, estimand, status/antagelser og diagnoser; Value-schemaet indeholder ingen lukket operationsliste.

Codec udfører ikke partitionstest, totalberegning, sortering efter numerisk værdi eller statistik. En shape-valid klasse med lower>=upper eller total=0 er repræsenterbar, ikke matematisk godkendt. Ingen validated-markør lagres. Begge statistikvarianter er typed Values, aldrig automatisk scalars. Fremtidige transformationer bevarer komplette forgængerresultater og typed parametre i provenance. Ingen generisk estimated->known eller approximate->exact-propagation er godkendt.

Matematisk accepteret uden ny implementeringstilladelse: dansk venstreåben/højrelukket klassekonvention og piecewise-uniform-cdf/v1 fra S100l. Profil/persistens/konstruktorsyntaks, konkrete grouped-producenter og andre beregningsmetoder er fortsat separate gates.

## 5. Accepterede P0009-codecproducenter

Begge bruger den eksisterende P0009 Diagnostic-envelope; lokale exceptions må bære en trusted error.diagnostic. isValue forbliver en boolean-genkender. Ingen alternativ diagnose-envelope eller tekstklassifikation.

| Code | Obligatoriske, udtømmende parametre |
| --- | --- |
| `unsupported-value-encoding` | `{path:string,feature:string,actual:string,supported:string-list}`. feature kun `value-version`, `value-kind` eller `statistics-variant`. |
| `invalid-value-encoding` | `{path:string,reason:string}`. reason én af `json-syntax,record-shape,field-set,version-shape,leaf-shape,variant-shape,nesting-version,mutable-value,non-json-data`. |

Paths er stabile slash-stier med arrayindeks; rodstien er "/" og recordnøgler bruger JSON Pointer-escaping af ~ og /. Ugyldigt typede versionfelter er shape-fejl; actual er aldrig et vilkårligt stringificeret objekt. supported er en ikke-tom strengliste. Codec accepterer ikke ukendt encoding/variant som en metadata-pose. Ukendt metode alene er ikke unsupported-value-encoding.

**Ressourcepolitik USER-ACCEPTED 23. oktober 2026:** Et helt v2-træ, inklusive embedded v1 og hver gentaget forekomst af shared provenance, må højst have dybde 128 (rod=0), 100.000 besøgte JSON-værdier og 8 MiB canonical UTF-8-encoding. Recordnøgler tæller i bytes, men ikke som selvstændige JSON-værdier. Grænserne er generelle operationelle codecgrænser, ikke statistikdomæner eller schemafelter. Eksisterende top-level v1 ændres ikke.

Den accepterede P0009-producent `value-codec-resource-limit` har præcis `{path:string,resource:string,limit:non-negative-integer}`; resource er `depth`, `nodes` eller `encoded-bytes`. Overskridelse afviser kontrolleret uden trunkering eller metadata-tab. Hver forekomst tælles ved shared acyclic input, så clone-ekspansion er budgetteret.

V2-JSON-ingress skal preflightes før fuld JSON.parse/json.loads: nesting/noder og normaliserede JSON-tokenbytes kontrolleres uden at allokere det fulde træ. Whitespace ignoreres; scanning er derfor lineær i den allerede modtagne teksts længde. Canonical-budgettet er ikke et rå message-/netværksbudget eller en løsning på v1's gamle ubudgeterede parser. Disse ydre grænser tilhører S100m2. Versionsdispatch identificerer top-level v1 uden at indføre de nye grænser i dens eksisterende decode-sti.

## 6. Versions- og udvidelsespolitik

Inkompatibel eksisterende encoding/field-shape/discriminatorbetydning/nesting kræver en ny accepteret Value-version. Nye metoder/operationer med repræsenterbare input/output kræver registrerede producent-/forbrugerkontrakter og tests, ikke ny Value-version. Ændret matematisk metodebetydning kræver nyt metode-id/version.

Nye matematiske domæner kræver særskilt accept; kun hvis schemaet ikke kan repræsentere dem, opstår yderligere encodinggate. Dokumentformat, profil, persistens og migration versionsbesluttes separat fra Value. UI-sprog må aldrig ændre matematisk betydning. Ingen intern schemaVersion indføres.

Gamle v1-decodere forventes ikke at forstå v2. Ingen downgrade, legacy-fallback eller automatisk genberegning af historiske snapshots. Eksisterende factories og deres v1-only-semantik ændres ikke; en eksplicit v2-factory er nødvendig.
