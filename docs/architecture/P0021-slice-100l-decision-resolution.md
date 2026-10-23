# S100l — beslutningslukning og næste kontraktgate

22. oktober 2026. Basis: `architecture-v1-implementation`, HEAD `462deb0381ea5b624cd9ad41ceb06dd4069fcc58`.
**INFORMATIVE beslutningsaddendum; ikke FROZEN eller accepteret ADR.** Dette dokument lukker de nedenstående matematiske valg på brugerens instruktion. Arkitekturvalg er fortsat forslag. Ingen produktionskode, ny Value-kind eller metodeimplementering er tilføjet.

## USER-ACCEPTED — matematisk betydning

- **Dansk intervalstandard:** Venstreåbne, højrelukkede klasser, fx `]0;10]`, `]10;20]`, `]20;40]`. Inklusion bæres af eksplicitte matematiske endepunktsflag; 10 tilhører første klasse, 20 anden klasse. `[0;10]` skal kunne angives eksplicit for at inkludere 0. UI-sprogskift må aldrig ændre flag eller medlemskab. Den konkrete versionsbestemte dokumentprofil, konstruktorsyntaks og persistens er ikke dermed vedtaget eller implementeret.
- **Grupperet median/kvartiler:** S100l's metode A er godkendt som newCAS-standard for intervalgrupperede observationer. Metode-id fastholdes som `piecewise-uniform-cdf/v1`. Antagelsen er jævn fordeling inden for klassen; resultaterne er **modelestimater**, også ved eksakt rationalaritmetik.

For p∈{1/4,1/2,3/4}, N=Σh, H_j=Σ(i≤j)h_i, w_j=U_j−L_j:

`Q_hat(p) = L_j + w_j · (pN−H_(j−1))/h_j`.

Vælg den **første positive** klasse, hvis kumulerede hyppighed når pN. Nulklasser bruges aldrig som divisionsklasse. Ved præcis kumuleret grænse bruges denne venstre klasses øvre grænse; et plateau giver plateauets venstre ende. Ukendte faktiske min/max må ikke erstattes af klassegrænser. Uden en endelig interpolationsbredde må målklassen ikke give et opdigtet resultat. Konkrete diagnoseproducentschemaer er fortsat OPEN.

Godkendte referencekonsekvenser fra S100l:

| Klasser / counts | Modelkvartiler |
| --- | --- |
| `]0;10]`, `]10;20]`, `]20;40]` / [2,3,5] | [35/3,20,30] |
| Samme klasser / [2,0,2] | [5,10,30]; median 10 ved plateauets venstre ende |
| `]0;10]` / [1] | **[5/2,5,15/2]** |

Singletonresultatet er en konsekvens af den godkendte **modelmetode**. S100h's rå/discrete singletonkvartiler `[x,x,x]` og femtalsresumé `[x,x,x,x,x]` ændres ikke. S100l's metode B er ikke valgt som grupperet standard. Midpoint-momentmetoden og øvrige forslag i S100l er ikke automatisk godkendt af denne beslutning.

**USER-ACCEPTED — senere UI-/Plotly-krav:** Vis sumkurven fra grouped-data, markér 25 %, 50 % og 75 %, og vis de tilhørende interpolerede kvartiler på observationsaksen. Observerede klassefakta og modelinterpolation skal kunne skelnes tydeligt. Det er et fremtidigt præsentationskrav; ingen grafik, Plotly- eller rendererændring foretages her.

## PROPOSED — to typed arkitekturer

Begge alternativer skal bære datagrundlag, metode, estimand, beregningsmæssig eksakthed, estimatstatus og modelantagelser **inde i den matematiske Value**. Ingen fri backend-sidecar, automatisk `approx`-konvertering eller skjult unwrapping til ExpressionValue.

- **A:** Én overordnet `StatisticsValue` med disjunkte, eksplicit versionerede varianter, fx `grouped-data` og `statistical-result`.
- **B:** To overordnede Value-kinds: et grupperet datasæt og et estimeret statistisk resultat. Navne og versioner er ligeledes forslag.

| Vurdering | A — én kind, to varianter | B — to kinds |
| --- | --- | --- |
| FROZEN / P0005 / versionering | Passer til coarse-grained typed Values, **hvis varianten er obligatorisk og valideres**. Én ny kind, men to selvstændige schemaer. | Tydelig forskel allerede på kind-niveau; også to schemaer. Begge kinds er nye kontrakttilføjelser. |
| Worker/Pyodide / P0010 | En decodergren med variant-dispatch. Backend producerer navngivne, JSON-portable records og eksisterende eksakte scalarelementer. | To decodergrene; samme krav til scalarelementer/metadata. Ingen af alternativerne kræver fri metadata på P0010-success. |
| Immutability / lighed | Deep clone/freeze og canonical encode/decode for hver variant. En grouped-data-Value er aldrig lig en result-Value. | Samme krav; forskel mellem dataset/result fremgår af kind. Ingen numerisk lighed alene må slette estimatstatus. |
| DocumentRuntime / providers | Efter gyldig Value-understøttelse bruges almindelig providerbinding, resultatpublicering og dirty-genberegning. Ingen særlige dokumentregler. | Samme. To kinds giver ikke behov for en ekstra dokumentmodel. |
| Senere estimataritmetik | Resultatvarianten kan senere understøttes eksplicit af operationer. Data-varianten skal afvises som scalar. | Resultat-kind giver enklere ydre type-dispatch; propagation og tilladte operationer skal stadig defineres. |
| Rendering / diagramgrundlag | Renderer vælger variant; grouped-data bærer klasser/counts, resultat bærer mål/metode/status. | Renderer vælger kind; samme information og fremtidige histogram-/sumkurveprojektioner. |
| Serialisering / historik | Ukendt variant/schema/metodeversion må ikke omfortolkes som et aktuelt defaultvalg. | Ukendt kind/schema/metodeversion må heller ikke omfortolkes. Begge kræver gammel decoderkompatibilitet og migrationspolitik. |

**Anbefaling: A som den mindste første kontraktudvidelse.** Det begrænser antallet af nye ydre kinds og ligger i S99's rige statistikretning. Det sparer ikke de to schemaer og er ikke i sig selv enklere matematisk. B er et holdbart alternativ, særligt hvis selvstændig estimate-scalar-aritmetik prioriteres nu. A anbefales kun med en strengt tagged union; en løs fælles `data`-pose er ikke tilstrækkelig.

Minimumsskitse for A, **ikke et gyldigt nuværende Value-format**:

```text
StatisticsValue(grouped-data):
  schemaVersion, variant, basisKind="interval-grouped",
  classes=[{lower,upper,lowerClosed,upperClosed,count}, ...]

StatisticsValue(statistical-result):
  schemaVersion, variant, basis=<immutable grouped-data snapshot>,
  statisticId="quartiles", methodId="piecewise-uniform-cdf/v1",
  estimand="within-class-model-quantiles", arithmetic="exact",
  estimateStatus="model-estimate", assumptions=<versioneret uniform-model>,
  value=<ListValue med tre eksisterende eksakte ExpressionValues>
```

Resultatet er en matematisk Value, ikke en ny transport-outcome med succes/fejlgrene. Basis-snapshot er en afledt matematisk værdi, ikke et andet autoritativt dokument. Ingen block-id'er, provideropslag, UI-locale eller levende backendobjekter indbygges. Provideridentiteter/revisioner forbliver hos eksisterende semantik/runtime.

**Foreslået lighed:** Canonical repræsentationslighed omfatter variant/schema, klassegrænser/flag/counts, basis, metode, estimand, arithmetic, status, antagelser og selve resultatværdien. Samme tal fra forskellige metoder/datagrundlag er ikke automatisk samme statistiske Value. Det er ikke en ny generel SymPy-lighedstest; numerisk lighed mellem scalarprojektioner er et andet spørgsmål. Locale, labels og formattering er ikke matematisk lighed. Canonical klasseorden/parring og eventuel normalisering skal kontraktfastlægges.

**Foreslået aritmetikafgrænsning:** Første slice understøtter repræsentation/transport, ikke implicit `estimatedQuartile + 1`. En senere operation må enten bevare status/metode/estimand under en vedtaget propagationskontrakt eller afvise kontrolleret. Ingen automatisk scalarprojektion, der mister status. B løser heller ikke denne gate uden regler.

## OPEN — næste kontraktgates

1. **Valg A/B og præcist P0005-schema.** Anbefaling A er ikke USER-ACCEPTED. Beslut obligatoriske felter, versioner, nesting, validatorer og canonical equality. Godkend klasseinputdomæne, nulklassebevarelse, overlap/huller, units og støttede yderklasser; analyseforslagene er ikke vedtaget i kraft af metode A.
2. **Kompatibilitet og versionering.** P0005's nuværende kind-liste og `valueVersion=1` er lukkede i kode. Et payload-versionstal alene gør ikke den nye kind læsbar for gamle decodere. Beslut eksplicit versioneret kontrakttillæg/encoding-version, nested gamle Values, håndtering af ukendte versioner og filkompatibilitet. Ingen stiltiende ændring af frozen betydning. Hvis en normativ ændring kræves, skal den have versionsbestemt ADR og særskilt godkendelse.
3. **P0010/Worker.** Anbefal uændret success/failure-envelope med den nye type inde i `value`. Auditér request- og response-validering, Python-envelopechecks og Worker-rehydrering for den valgte Value-version. P0011's SymPy-adapter accepterer aktuelt ExpressionValue; en rig statistik-Value må ikke sendes direkte til den som en scalar. Virkelig Pyodide-transport er endnu ikke bevist for nogen ny type.
4. **Dokumentprofil/syntax/persistens.** Den matematiske danske default er accepteret; dens konkrete versionsbestemte dokument-/opgaveprofil, konstruktor og migration er OPEN. Ingen genopslag i aktuel localStorage/UI-locale. Submitted snapshots følger ADR-0005; historiske Values/metoder må ikke automatisk genberegnes eller opgraderes.
5. **Operationer og diagnoser.** Fastlæg konkrete producentkontrakter for ugyldige klasser, utilstrækkelig interpolationsinformation, ukendte versioner og forsøg på faktiske extrema. P0009's åbne transport er ikke en registreret diagnosekontrakt. Godkend senere arithmetic/extraction separat. Metode A kan ikke implementeres ved blot at miste estimatmetadata i eksisterende bare `quartiles`-output.

## Næste lille slice — S100m: Value-kontrakt og materialiseret transport

**Startgate:** Godkend A/B og versionsstrategi først. Næste første leverance er et præcist P0005-tillæg med to komplette schemaer og fixtures, fx `docs/architecture/P0005-statistics-value-contract-proposal.md`; nødvendigt ADR-udkast vedlægges til særskilt godkendelse. Dokumentet må ikke selv vedtage en FROZEN-ændring. Derefter kan den godkendte repræsentationsdel implementeres som en afgrænset RED→GREEN-slice.

**Foreslået filafgrænsning efter godkendelsen:** `src/js/values/value.js` (evt. en lille underordnet statistik-Value-validator), `tests/js/p0005-statistics-value-contract.test.mjs`, den eksisterende Worker-rehydreringstest eller en særskilt statistiktransport-fixture i `tests/browser/`, og kun de Python/transport-versionchecks, som den valgte encoding-version nødvendiggør. `src/python/evaluator/container_list.py` kan kræve versionskompatibilitet; ingen statistisk beregning skal tilføjes dér. Ingen parser, DocumentRuntime-særregler, dokumentprofil/persistens, statistikoperationer, renderer eller Plotly i denne første slice.

**Foreslåede RED-tests og acceptkriterier:**

- Begge disjunkte varianter konstrueres, detached/fryses dybt og encode/decode-roundtripper. Manglende discriminator, blandede variantfelter, ukendt version og malformed nested Values afvises. Muteret input efter konstruktion ændrer ikke Value.
- Repræsentationslighed skelner basis/klasseflag, metode og estimatstatus, selv når den numeriske del er identisk. Rå/discrete gamle Values og operationer er uændrede.
- Allerede materialiserede grouped-data-/resultatfixtures, herunder `[5/2,5,15/2]` med modelstatus, sendes gennem **eksisterende selected `list`-konstruktion i rigtig Worker/Pyodide** og returneres som typed, immutable Values. Det tester transport uden en ny test-only public operation eller backend-sidekanal. Det beviser ikke den endnu uimplementerede grouped-algoritme.
- Generic runtime/provider-tests publicerer og genbruger fixtures som Values uden dokumentmirror; invalidation/stale-result-værn består. Forsøg på automatisk scalarbehandling må ikke omdanne resultatet til et umærket tal.
- Fokuserede Value/P0010/Worker-regressioner, fuld npm med uændret TODO/SKIP, reel browsertransport, parser-sync og diff-check kræves før GREEN. Nye typer må først påstås understøttet, når begge transportretninger er bevist.

Efter denne gate kan en separat **S100n** implementere den godkendte metode A på materialiseret grouped-basis med typed modelresultater og reference-/plateau-/nulklasseprøver. Konstruktorsyntaks, dokumentdefaults/persistens og sumkurve-UI forbliver særskilte slices.

## Grundlag og verifikation af denne lukning

Genkontrolleret mod P0005 §§2–4, P0010's konkrete envelopes, FROZEN §§14/25 samt accepted ADR-0004/-0005/-0006. S100l-forslaget er bevaret som analyse; dette addendum har forrang for dets tidligere åbne A/B-metodevalg. **Metode A i analysen er ikke det samme valg som arkitektur A ovenfor.** ADR-0007 er ikke accepted.

Kun dokumentation er ændret. Ingen npm-/browserkørsel eller nye implementeringstesttal påstås for beslutningslukningen; RED-tests ovenfor er næste slices forslag. Git-status/diff-check kontrolleres ved aflevering. Ingen staging, commit, push, reset eller clean; eksisterende lokale artefakter bevares.
