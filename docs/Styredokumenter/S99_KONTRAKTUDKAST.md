# newCAS — S99: Kontraktudkast for matematisk beta, data og præsentation

**Status:** Revideret S99-kontraktudkast (r2, efter Claudes kritiske review og ejerbeslutninger) — **ikke** godkendt ADR, ny FROZEN-version, implementeringsordre eller releaseplan
**Dato:** 22. oktober 2026
**Foreslået repo-placering:** `docs/Styredokumenter/S99_KONTRAKTUDKAST.md`
**Grundlag:** S99-samtalen; Claudes `S99 — kritisk arkitektur- og matematikreview.md`; `CODEX_HANDOVER_S99.md`; `ROADMAP_AKTUEL.md`; FROZEN v1.0; accepterede ADR'er, især ADR-0004/-0005/-0006; P0005, P0008, P0010. **Disposition:** se `S99_CLAUDE_REVIEW_DISPOSITION.md`.
**Fortolkningsnøgle:** **Aftalt retning** = enighed om ønsket produktadfærd i S99-samtalen. **Forslag** = konkret, endnu ikke godkendt kontraktvalg. **Åbent/gate** = beslutning eller verifikation før den relevante implementeringsslice. Eksempler er *illustrativ elevsyntaks*, medmindre andet udtrykkeligt er angivet. **Dette dokument ændrer ikke FROZEN eller P0005/P0008/P0010.**

## 1. Formål, omfang og autoritet

S99 samler matematiske og pædagogiske produktvalg, så kommende implementeringsslices kan være små og kontraktstyrede frem for at opfinde API'er enkeltvis. Målet er først en **brugbar matematisk beta på den valgte IR/Value/Worker-vej**, dernæst en gennemarbejdet elev-UI og studenterrelease. S99 implementerer ikke funktionerne.

**Normative grænser, som ikke ændres her:**

- Den autoritative matematiske tilstand ligger i dokumentet, ikke i evaluator, Worker, UI eller Python-scope. Der er ét matematisk sprog og én semantisk motor.
- Definitioner, lokale funktionsbindere, positionelt scope, immutable/captured Values, invalidering og genberegning følger FROZEN v1.0 og accepterede ADR'er.
- OperationSpec/IR er den valgte matematiske vej. Ingen ny parallel evaluator eller Python-kodestreng-generering/`exec`/`eval` i den valgte motor.
- Diagnoser er strukturerede og sprogneutrale (kode/parametre); UI oversætter dem.
- Plotning fremstiller matematik og må ikke selv bestemme scope eller matematisk betydning.
- En redigerbar `.ncas` og et **Submitted Snapshot** har forskellige formål. En frossen aflevering genberegnes ikke automatisk; PDF genereres fra snapshot, jf. ADR-0005.
- Ved behov for ændringer af allerede frosne kontrakter udarbejdes en særskilt, versioneret ADR til godkendelse **før** implementering.

**Ikke i denne omgang:** differentialligninger; generelle funktioner af to variable/partielle afledte; fuld generel symbolsk sandsynlighedsregning; komplet specialiseret statistikpakke; endelig elev-UI; fuld grammatikfrysning. Vektorregning kommer senere i prioriteringen.

## 2. Pædagogisk designprincip — aftalt retning

> newCAS skal støtte matematisk problemløsning og elevens forståelse uden systematisk at automatisere **oversættelsen fra opgaveformulering til matematisk metode**.

Generelle operationer som `solve`, `diff` og `integrate` er naturlige. Facitgenveje som `rødder(andengradspolynomium)` eller `toppunkt(f)` prioriteres ikke, når elevens oversættelse til en ligning, en afledt funktion eller en formel netop er læringsmålet. Specialoperationer med selvstændig matematisk betydning (statistik, regression og hypotesetest) er fortsat legitime. En matematisk beta skal være praktisk anvendelig, ikke kunstigt besværlig.

**Monotonilinje — fremtidigt UI-ønske, IKKE S99-kontrakt eller beta-gate.** Ønsket er en guidet tegning ud fra elevens analyse af afledt funktion, kritiske punkter, fortegn, domænebrud og funktionsværdier. Det er *ikke besluttet*, om sådanne trin kan identificeres pålideligt i eksisterende dokumentstruktur, eller om UI skal kræve eksplicit navngivne analyseresultater. S99 kræver hverken implicit søgning gennem vilkårlige tidligere blokke eller en operation `monotonilinje(f)`. Ingen evaluator må få skjult blokorden-/scope-autoritet. En senere undersøgelse skal skelne mellem UI-skabelon, matematisk verificering og ikke-verificerbar elevdokumentation, herunder stale/invalidation. En fortegnsprøve kan begrunde fortegnet på et interval, *hvis* kontinuitet og fuldstændighed af nul-/brudpunkter er godtgjort; programmet må ikke foregive, at dette generelt kan bevises. Øvelses-/eksamensvisning ændrer ikke matematisk betydning.

## 3. Grundmønster: rige Values med enkle elevgenveje — aftalt retning

Et Value er **én matematisk værdi**, men behøver ikke være ét tal. Et punkt, en funktion, en mængde eller et statistisk testresultat kan have flere sammenhørende komponenter. Vi fastholder derfor fire **tilsigtede** rige, immutable, backend-uafhængige resultattyper:

| Resultattype | Formål | Eksempler på egenskaber |
| --- | --- | --- |
| `RegressionValue` | Regression | Model som almindelig `FunctionValue`, koefficienter, fitmål, evt. residualer |
| `StatisticsValue` | Deskriptiv statistik | Observations-/grupperingstype, valgte metoder, kvartiler, spredning, estimatstatus og hyppigheder |
| `DistributionValue` | Sandsynlighedsfordeling | Familie, navngivne parametre, PMF/PDF, CDF, forventning, spredning og typetal |
| `TestResultValue` | Hypotesetest | Nul-/alternativhypotese, observation, retning/metode, nulfordeling, p-værdi og evt. kritisk område |

**Status og versionsgate:** FROZEN §14/§29 tillader designretningen, men P0005 v1's faktisk tilladte Value-kinds og felter er snævrere. Hver ny kind/feltudvidelse kræver et **eksplicit versioneret P0005-tillæg** samt kontrollerede AST/IR-, Python-adapter-, Worker-transport/rehydrerings-, renderer- og persistensgrænser. Typerne er *ikke allerede implementeret* blot fordi vi ønsker dem. Der er ikke valgt endelig payload/schema endnu.

Vi **opgiver ikke** `StatisticsValue` eller `TestResultValue` alene for at spare en type. Deres behov skal dog dokumenteres ved den relevante slice, og de første simple operationer kan implementeres med ordinære Values inden den rige type. At udskyde en implementering ophæver ikke designretningen. Ingen stor eager residual- eller datakopi, hvis den ikke er nødvendig. Præsentation må kun vise matematiske oplysninger, der allerede findes i dens payload; nye afledte resultater kræver eksplicitte rene operationer, ikke skjult UI-beregning.

**Fælles returformer — foreløbig anbefaling:** `kvartilsæt`/`udvidetKvartilsæt` returnerer `ListValue` i defineret rækkefølge (parenteser er evt. blot visning). `mode(X)` returnerer konsekvent en endelig `SetValue`, også ved ét typetal. Binomialtestens accept-/kritiske mængder er **heltalsmængder**, ikke reelle intervaller; en konkret repræsentation af sammenhængende heltalsområder og tomme mængder skal kontraktfastlægges i P0005. Disse valg kræver verificering mod gældende Value-kontrakt.

## 4. Data, Excel-import og listedefinitioner — aftalt retning

- Matematiske input er ordinære lister. Regression tager primært **to lister** `X` og `Y` med parrede observationer og samme længde. En eventuel liste af ordnede par kan tilføjes som bekvemmelighed; ingen særlig `PointValue` eller `DataFrameValue` er nødvendig i den første beta.
- Lokalt drag-and-drop af `.xlsx` (gerne senere CSV) skal ved en enkel, regelmæssig tabel kunne føre til almindelige listedefinitioner med navne fra kolonne-/rækkeoverskrifter. Flere numeriske kolonner må gerne blive til flere lister.
- Lodret og vandret orientering understøttes. Hvis eksempelvis et 2×2-taludsnit uden overskrifter er tvetydigt, **spørger importen** om række-/kolonneorientering; den gætter ikke. Import er ikke det samme som at bestemme regressionsmodellens x/y-roller.
- Importen skal være lokal/offline, valideret og **atomar som dokumentændring**, med ét Undo-trin. Afvis ugyldige eller tvetydige celler, inkonsistente længder hvor parring kræves, navnekollisioner og navne der ikke er gyldige i newCAS. Ingen stiltiende rensning eller overskrivning. Angiv relevante ark-/cellepositioner i fejlbeskeden og foreslå manuel markering/kopiering fra Excel ved uregelmæssige data.
- Indlæste data skal kunne bruges og genskabes uden den oprindelige Excel-fil. Kildelister er autoritative; `ListValue` i runtime er afledt. Regler for store datamængder og evt. kompakt fremtidig datalagring er **åbne**.
- Importadapteren må ikke afvikle regnearksformler/makroer eller tolke uvedkommende celleindhold som matematikprogram. Cached formelværdier, manglende caches, arkvalg og overskriftsnormalisering kræver konkret importkontrakt.

**Grammatik-gate:** FROZEN §15 angiver `[1,2]` som `ListValue` og eksplicitte vektorkonstruktører; den gennemsete ældre `Grammatik.pegjs` har derimod `{…}` som liste og `[…]` som vektor. Endelig elevsyntaks **må ikke antages implementeret**. P0018/F8 skal afklare og teste den kanoniske grammatik og decimal-/argumentseparatorer, før importerede definitioner sættes i produktion.

## 5. Deskriptiv statistik — aftalt retning

### 5.1 Inddataformer

1. Ugrupperede observationer i én liste, gentagelser bevaret.
2. Ugrupperede værdier plus **absolutte hyppigheder** i en tilsvarende liste.
3. Intervalgrupperede observationer som eksplicitte klassegrænser/intervaller og tilhørende hyppigheder (evt. relative frekvenser, når størrelsen kan bestemmes deraf).

Tvetydige inddata fortolkes ikke automatisk som én bestemt statistiktype. Ugrupperede observationer og de ækvivalente værdier/hyppigheder skal producere **samme** matematiske mål. Absolutte hyppigheder skal være ikke-negative **heltal**, og samlet hyppighed skal være positiv for almindelige mål. Håndtering af nulhyppigheder, gentagne kategorier og ikke-heltallige vægte skal være eksplicit og testes; ingen tavs fortolkning som vægte.

### 5.2 Definitioner og konventioner

- Standardkvartiler for ugrupperede data: sorterede observationer med gentagelser; medianen er midterste værdi eller gennemsnittet af de to midterste. `Q1` og `Q3` er medianerne i hver halvdel. Ved ulige `n` **udelades** den midterste observation fra begge halvdele. Fx `n=7`: `Q1=x2`, `Q2=x4`, `Q3=x6`. `n=8`: `Q1=(x2+x3)/2`, `Q2=(x4+x5)/2`, `Q3=(x6+x7)/2`.
- Andre kvartilkonventioner kan senere tilbydes navngivet; ønsket standard kan variere efter undervisningstradition, men valgt metode er del af den **persistente matematiske betydning**, ikke en effekt af aktuelt UI-sprog.
- Standardvarians/-spredning i almindelig deskriptiv statistik bruger divisor `n`. Korrigeret stikprøvestandardafvigelse med `n-1` er en særskilt operation/parameter og nødvendigvis tilgængelig til eksempelvis t-test senere.
- Ved intervalgrupperede data anvendes intervalmidtpunkter til estimeret middelværdi/spredning og kumulerede frekvenser med aftalt lineær interpolation til kvartiler/percentiler. Disse er **estimater**, ikke eksakte værdier; faktisk minimum og maksimum kendes normalt ikke.
- Relative frekvenser uden kendt observationstal fastlægger ikke generelt ugrupperede kvartiler efter median-af-halvdele-definitionen. Returnér en passende **struktureret diagnose**, ikke et gæt. Udvidelsen med både `n` og tilstrækkeligt præcise relative frekvenser er senere; afrunding kan gøre rekonstruerede hyppigheder tvetydige.
- For små datasæt (`n=0,1`), klassegrænser (ofte ]a;b] i dansk undervisning), interpolation i randen, percentilkonvention og eksakt versus afrundet talrepræsentation udestår detaljeret operationskontrakt. Disse valg skal dokumenteres som konventioner, hvor de kan ændre resultater.
- For ugrupperede data kan rene relative frekvenser uden kendt antal give forskelligt `Q1`: værdier `[1,2]`, relative frekvenser `[0.2,0.8]` giver ved `n=5` data `[1,2,2,2,2]` og `Q1=1.5`, men ved `n=10` én 1'er og ni 2'ere og `Q1=2`. Middelværdien er ens.

### 5.3 Resultater og API

Et fælles `StatisticsValue` eksponerer meningsfulde statistiske mål med inputtype, metode-id og tilnærmelsesstatus. Til elevbrug ønskes `kvartilsæt(data)` → en `ListValue` `[Q1,Q2,Q3]` og `udvidetKvartilsæt(data)` → `[min,Q1,Q2,Q3,max]`, sidstnævnte kun for ugrupperede data med faktiske yderpunkter. Navne/notation kan vises som tuple uden at indføre en implicit vektortype. Egenskabsfunktioner `mean`, `median`, `standard_deviation` og `quartiles` skal anvende samme matematiske algoritme, ikke UI-kopier. **Divisor `n` er aftalt som standard for deskriptiv spredning**; både navn og dokumentation skal tydeliggøre forskellen til `n-1` og t-test. Alt her er provisorisk elevsyntaks, ikke en godkendt OperationSpec.

## 6. Regression — aftalt retning, med metode-gate

- **Produktmål:** En fælles regressionsmekanisme giver et immutable `RegressionValue` med en almindelig `FunctionValue` som model; samme overordnede struktur for lineær, eksponentiel, potens- og polynomiel regression. `model(...)` er en enkel elevgenvej til modellens `FunctionValue`, ikke en alternativ fitmotor. Afledte funktioner, funktionskald mv. skal fungere normalt.
- **Åbent grammatik-/OperationSpec-valg (B2):** Illustrativ `regression(X,Y,modeltype)`/`model(X,Y,modeltype)` forudsætter en entydig, *ikke brugerbundet* måde at angive modeltype på. V1-OperationSpec har ikke enum-/strengargumenter. **Ingen symbolnavne som `linear` eller `right` må stiltiende opløses som brugerens variable.** En praktisk v1-vej kan være separate operationer `linreg(X,Y)`, `expreg(X,Y)`, `potreg(X,Y)`, `polyreg(X,Y,d)` og tilsvarende funktionsgenveje, alle via én fælles implementering. Et generisk optionsargument kræver et versioneret P0008-/Value-kontraktvalg. Den endelige elevsyntax er *ikke valgt*.
- **Matematisk metode-gate (B4):** For hver regressionsfamilie **skal** fitkriterium, inputkrav, koefficientroller, numerisk præcision, degenererede tilfælde og betydningen af `R²` fastlægges *før dens implementeringsslice*. Især eksponentiel/potensregression: lineær mindste-kvadraters regression på `ln(y)` (potens også `ln(x)`) og ikke-lineær mindste kvadrater på de oprindelige værdier giver generelt **forskellige modeller**. **Foreløbig anbefaling**, ikke vedtagelse: skolens log-lineære fit for eksponentiel/potens og mærket `R²` på transformeret skala. Andet kriterium kræver andet deklareret metode-id; værdier må ikke udgives som sammenlignelige uden markering.
- `a·e^(kx)` versus `b·a^x` kan beskrive samme model med anden parameterisering; indre koefficientroller skal være locale-neutrale, og præsentationen vælger lærebogsnotation uden at ændre den fittede funktion.
- Residualer og større diagnostiske datasæt beregnes efter behov via rene operationer med tilstrækkelig information; UI viser normalt kun forskriften og kan vise flere egenskaber på anmodning.

## 7. Sandsynlighedsfordelinger — aftalt retning med grammatik-gates

**Ønsket lærebogsnær notation (ikke frossen PEG):**

```text
X ~ b(10, 0.34)
Y ~ n(5, 0.2)
P(2 <= X < 4)
P(Y >= 4)
mean(X)                  # UI kan vise μ(X)
standard_deviation(X)    # UI kan vise σ(X)
mode(X)
```

- `~` skal, hvis det indføres, være en **definitionsform**, der etablerer en dokument-skriver af typen `DistributionValue`, ikke en relation uden skriver. Overfladesyntaksen kan evt. være ækvivalent med en almindelig `X := binomial(10,0.34)`; dette og betydningen af kopier (`Z := X`) fastlægges i grammatik-/Value-kontrakten. Flere stokastiske variable i samme hændelse og deres fællesfordeling/uafhængighed er uden for beta.
- `b(n,p)` betyder binomialfordeling; `n(μ,σ)` betyder normalfordeling med **standardafvigelse** `σ` som parameter 2, ikke variansen. Geometrisk fordeling tæller forsøg **indtil og med første succes** (`1,2,…`); alternative konventioner skal have andet entydigt id. Distributionens familie og parametrene skal være sprogneutralt repræsenteret og versioneret.
- **Navnekollision (D4):** `b`, `n` og `P` kan også være elevens almindelige variable/funktioner. Vores v1-navnebinding må ikke ændres ad hoc. Mulig løsning: familiekonstruktørerne `b`/`n` opløses *kun kontekstuelt* som del af `~`-definitionen; fulde navne `binomial`/`normal` anvendes som almindelige operationer. Den præcise forrang mellem `P(...)` og en brugerdefineret funktion `P` afgøres eksplicit før PEG/IR-implementeringen.
- `DistributionValue` eksponerer fælles matematiske egenskaber: `mean`, `standard_deviation`, varians, `mode`, PMF/PDF, CDF og fraktiler, hvor de er definerede. **`mode` er altid en samling/mængde** af alle modalværdier (også én), og kontinuert mode vedrører tæthedsmaksimum, ikke positiv punktsandsynlighed. Diskret fraktil anbefales defineret som mindste `x` med `F(x) >= q` — endelig operationskontrakt før implementering.
- `P(a <= X < b)` kræver **én fælles semantisk repræsentation af kædede relationer** som også kan tjene domænebegrænsninger og stykkevise funktioner. For en hændelse med præcis én fordelingsoperand må relationen ikke evalueres som almindelig boolesk værdi før `P` modtager den. Dette kræver P0005/P0018-afklaring. Alternativ repræsentation må ikke opfinde en parallel evaluator. Symbolske, uafklarede grænser giver eksplicit `unsupported` i betaen, ikke et opdigtet tal. `P(X+Y>c)` udsættes.
- Sandsynlighedstabeller kan give en diskret fordeling ud fra værdier og sandsynligheder; alle sandsynligheder ikke-negative, værdier distinkte (eller eksplicit aggregeret) og sum 1 efter en dokumenteret eksakt-/tolerancepolitik. Sidstnævnte hænger sammen med P0018's eksakte decimal-literaler.
- Direkte `binompdf`/`binomcdf`/`normpdf`/`normcdf` og inverse funktioner bevares, men *argumentrækkefølge* og medtagelse af intervalgrænser fastlægges i én offentlig kontrakt. Legacy- og TI-varianter må ikke sammenblandes lydløst. Ved normalfordeling er `P(X=k)=0`, mens PDF kan være positiv.

## 8. Hypotesetest — aftalt retning med eksplicit metodevalg

### 8.1 Fælles testframework

`TestResultValue` er ønsket som **rigt, selvstændigt matematisk resultat** med nul-/alternativhypotese, nødvendige parametre, observation/teststørrelse, retning, beregningsmetode, nulfordeling hvor relevant og p-værdi. Dermed kan vi senere tilføje `χ²`-goodness-of-fit, `χ²`-uafhængighed, én-/to-stikprøve- og parrede t-test med testspecifikke felter. Første matematiske beta prioriterer binomialtest; den kan bygge enkeltoperationer først, men designet af `TestResultValue` **opgives ikke**.

### 8.2 Foreslået elev-API — ikke godkendt grammar/OperationSpec

```text
t := binomtest(18, 50, 0.25)    # observeret k, n, p0; tosidet som dokument-default
pvalue(t)
acceptance(t, 0.05)
critical(t, 0.05)
decision(t, 0.05)

A := binom_acceptance(50, 0.25, 0.05)
K := binom_critical(50, 0.25, 0.05)
```

- **Tosidet er den ønskede standard i den danske undervisningsprofil**, men betydningen af ufuldstændigt specificerede kald bindes til en autoritativ **dokumentkonvention ved dokumentoprettelse**, ikke den aktuelle app-/locale-indstilling. Højre-/venstresidede test understøttes som eksplicitte former. V1-OperationSpec's mangel på enum-rolle betyder, at slutformen for retning og metode (separate operation-id'er vs. versioneret optionsrolle) er **åben B2-gate**. Samme gælder direkte `binom_acceptance`/`binom_critical`; deres korte former betyder dokumentets valgte standardretning/metode, og eksplicitte varianter skal findes uden tvetydige navne.
- **Tosidet lige-halebudget / fordoblet mindste hale (equal-tail):** `p(k) = min(1, 2*min(P(X<=k),P(X>=k)))`. Vi kalder den **`α/2` i hver hale**, ikke at diskrete haler har identisk sandsynlighed. Alternativt **sandsynlighedsordning**: summen af `P(X=j)` for `j` med `P(X=j) <= P(X=k)`. Metoden er et eksplicit, persistensbundet matematisk valg, ikke et tilfældigt resultat af softwareversion/i18n.
- `α` kræves ved `acceptance(t,α)`, `critical(t,α)`, `decision(t,α)`, men ikke ved `pvalue(t)`. Vi antager **ikke** 5 % implicit i disse kald. Testresultatet indeholder `n`, `p0`, retning og metode, så acceptmængden kan bestemmes uden ny indtastning af disse værdier.
- **Præcis sammenhæng:** For en fast binomialtestmetode og retning er `critical(t,α) = { k ∈ {0,…,n} : pvalue_under_metoden(k) <= α }`; `acceptance` er komplementet **inden for** `{0,…,n}`. Hermed er `decision(t,α)` konsistent med p-værdien: forkast iff `p <= α`; aldrig »bevis at H₀ er sand«. Direkte `binom_acceptance(n,p0,α)` beregner samme mængde som `acceptance(t,α)` *når retning og metode er de samme*. Kritiske og accepterede mængder må ikke repræsenteres som et reelt lukket interval ved et uheld.
- Eksakte eller pålideligt kontrollerede sammenligninger ved `p = α` kræver særskilt numerisk kontrakt; ingen tavs afrunding ved beslutningen. P0018's eksakte decimal-literal gate er relevant.

**Kontrolcase:** Ved `n=50`, `p0=0.25`, `α=0.05` er equal-tail-acceptmængden `{7,…,19}`, sandsynlighedsordning `{7,…,18}`. Ved observeret `k=19` giver metoderne henholdsvis p ≈ `0.05746632` og `0.04812403`; samme nulhypotese giver forskellige beslutninger. Dette er *forventet metodematematik*, ikke en softwarefejl.

## 9. Definitionsmængder og stykkevise funktioner — produktkrav, ADR før kodning

En eksplicit definitionsmængde skal være en **del af funktionens matematiske identitet**, ikke et UI-plotfilter. Ønsket notation (illustrativ, **ikke PEG-godkendt**):

```text
f(x) := x^2 - 4x, 0 <= x < 8
```

Ved reel variabel betyder eksemplet `Dm(f) = [0;8[`, `f(2)=-4` og `f(8)` udefineret. Men kommaet er konfliktfyldt ved danske decimaler, og intervalklammer kolliderer med liste-/vektornotation. Den endelige separator/syntaks afgøres i P0018, ikke ved streng-split eller UI-gæt.

**Matematisk minimum:** Et eksplicit, autoritativt domæneprædikat/-sæt fastholdes af funktionen og captures som andre funktionsegenskaber. Ved **konkret anvendelse** undersøges medlemskab på en dokumenteret måde i det valgte talområde: indenfor evalueres den oprindelige forskrift med almindelige matematisk begrundede begrænsninger; udenfor returneres en struktureret undefined-/domain-diagnose; ved uafgørligt medlemskab må man ikke stiltiende forlænge forskriften. Den »naturlige definitionsmængde« kan generelt ikke kræves fuldstændigt symbolsk beregnet. `Reals`/`Complexes` skal være en autoritativ matematisk dokumentindstilling, hvor den påvirker resultater.

**Åbent til særskilt domæne-ADR og P0005-version (B5/D12):** Repræsentation af prædikat/`SetValue`; betydning af `f(a)` ved frit symbol; symbolsk sammensætning og `diff`; hvilket domæne en afledt har (især ved randpunkter); filtrering af `solve`-resultater; uanalyserbare domæner og dækkende strukturerede diagnoser. Funktionens nuværende v1-felter må **ikke** ændres ad hoc. For operationer, hvor domænet ikke kan analyseres sikkert, returneres ærligt `unsupported`/`undetermined`, frem for en matematik uden den oprindelige begrænsning.

**Stykkevist definerede funktioner — senere:** fx `x²` for `x<0` og `2x+1` for `0<=x<5`. Grenebetingelser, overlap/gab, randadfærd og grænseværdier kræver separat operations-/grammatikarbejde. Vi skal undgå at lade simplifikation gøre funktionsdefinitionens oprindelige huller til gyldige punkter. Domæne-ADR'en skal holde døren åben for grene, ikke nødvendigvis implementere dem nu.

## 10. PlotSpec: åbne/lukkede punkter og huller — aftalt krav

Plotning skal på sigt kunne vise **matematisk begrundet** punktstatus:

- Stykkevis `f(x)=x²` for `x<0` og `f(x)=2x+1` for `0<=x<5`: **åben cirkel** ved `(0,0)` og **fyldt cirkel** ved `(0,1)`.
- `f(x)=(x²-1)/(x-1)`: grafen følger `x+1` for `x≠1`, men har en **åben cirkel** ved `(1,2)`; algebraisk forkortning må ikke udslette den oprindelige funktions manglende definitionspunkt.
- Eksplicit åbne/lukkede intervalendepunkter, greneskift, relevante domænehuller og siden asymptoter skal kunne repræsenteres strukturelt.

**Kontraktretning:** Detektion af domæne, huller, greneskift og diskontinuiteter er **matematisk analyse**, som skal ske som ren operation i den valgte evaluator/Worker med revisions-/generationsværn; ikke som skjult arbejde i renderer. En afledt `PlotSpec` (eller strukturerede analysedata som grundlag for den) føres via eksisterende præsentationsafhængigheder uden ny matematisk skriverautoritet. Rendereren tegner markeringer, men afgør ikke selv sandheden ud fra sampling. Ved uafgørlige tilfælde vises ikke falsk dokumenterede åbne/lukkede punkter. Det præcise kald fra præsentation til analyse kræver senere ADR-0004-afklaring før grafimplementering; det er **ikke en matematisk beta-blocker**. Ingen plotautoritet i `.ncas`.

## 11. `.ncas`, versionering og i18n — principbeslutning, schema-ADR senere

**Brugeridé:** Gem fx `dk-3` for dokumenter oprettet med den danske i18n-ressources 3. udgave. **Aftalt retning:** Ja til sporbarhed for oversættelser og visning, men `dk-3` må **aldrig bestemme dokumentets matematik**. FROZEN §22/§28 kræver ét matematisk sprog, hvor locale ikke ændrer kildebetydningen.

Hold følgende adskilt:

1. **`fileFormatVersion`**: `.ncas`-skema og migrationspolitik; ikke blot »formatVersion« opfundet i S99.
2. **`languageVersion`**: den versionerede kildegrammatik og de **parse-/resolution-relevante aliaser** (alternativt kan elevens input kanoniseres *inden det bliver autoritativ kilde*). Ikke afhængig af hvilken UI-locale der åbner dokumentet. Skelnes fra `engineVersion`, som er relevant for kompatibilitet/historik.
3. **Matematiske dokumentindstillinger/konventionsprofil**: eksempelvis kvartilregel, variansregel, binomialtestens defaultretning og tosidede p-værdimetode, regressions-fitkriterium, vinkelenhed og talområde (`Reals`/`Complexes`). Disse værdier fastlægges **ved dokumentoprettelse**, er autoritative og føres eksplicit gennem allerede eksisterende `options`-grænse til evaluator/Worker. Aktuel `localStorage`/sprog/nyeste appstandard må ikke tage over ved genåbning.
4. **`displayLocale` og `i18nResourceVersion`**, fx `da-DK` + `dk-3`: hjælpetekster, fejloversættelse, labels, format og forslag til inputaliaser. Ressourcens version er dokumentation, ikke matematisk betydning. Et konkret alias i autoritativ kilde skal forstås via `languageVersion` eller kanoniseres i redigeringsfasen.
5. **Submitted Snapshot**: versionerede historiske Values/visningsdata og nødvendige engine-/renderer-oplysninger efter ADR-0005; holdes adskilt fra en genberegnelig `.ncas`.

**Oprettelse, ændring og legacy:** Dokumentkonventioner opløses ved *oprettelse*, ikke »oprettelse/gemning«. Mangler felter i en ældre fil, vælges én eksplicit versioneret **legacy-profil**, ikke aktuel brugerstandard. Ændring af autoritativ konvention er en dokumenttransaktion, som invaliderer/genberegner berørte blokke. Om konventioner knyttes til dokumentet eller den enkelte opgaves matematiske scope er **åbent** og afgøres i persistens-ADR'en. Et uunderstøttet historisk metode-id skal give diagnose eller eksplicit migration, ikke stiltiende erstatning.

**Kilde og decimaltal (P0018/F8-gate):** Vi skal vælge enten (a) *kanonisk gemt kilde* uafhængigt af input-locale eller (b) *versioneret kilde-dialekt* med eksplicit parserkontrakt. UI må ikke foretage semantisk usikker strengomskrivning, og en ny locale må ikke genparse gammel kilde med nyt resultat. Bevar **decimal-literalens eksakte værdi eller en dokumenteret præcisionsrepræsentation**, ikke blot `parseFloat` i AST, når test- og statistikoperationer kræver eksakte sammenligninger. Dette er en fælles gate for statistik, sandsynlighed og test, ikke kun Excel-import.

**Illustrativ skitse — IKKE vedtaget `.ncas`-schema:**

```json
{
  "fileFormatVersion": 1,
  "languageVersion": "EXAMPLE-CANONICAL-1",
  "engineVersion": "EXAMPLE-ENGINE",
  "documentOptions": {
    "quartileMethod": "median-of-halves-exclude-center/v1",
    "descriptiveVariance": "population-n/v1",
    "binomialTestDirection": "two-sided/v1",
    "twoSidedBinomialMethod": "double-min-tail/v1",
    "exponentialFit": "UNDECIDED-METHOD",
    "angleUnit": "deg",
    "domain": "Reals"
  },
  "displayLocale": "da-DK",
  "i18nResourceVersion": "dk-3"
}
```

Feltnavne og værdier i skitsen er **ikke schemaautoritet**. En evt. fremtidig ændring fra `dk-3` til `dk-4` må kun ændre præsentation/foreslået input, aldrig resultatet af et eksisterende `.ncas`-dokument. Versionerede semantiske defaults skal gøre dokumentet reproducerbart i mening, men ingen garanti om identiske flydende resultater på tværs af alle backends ligger implicit her.

## 12. Implementeringsrækkefølge og verificeringsporte — forslag, ikke ordre

**Matematisk beta først, student-UI derefter.** Pragmatiske hovedprioriteter fra undervisningen: grundlæggende algebra/`solve`; trigonometri; ugrupperet/grupperet statistik og regression tidligt; differentialregning og integration; binomialfordeling/sandsynligheder og binomialtest. Vektorer og generelle differentialligninger/multivariable funktioner senere. Begrænset domæneafgrænsning prioriteres tidligt; fuld piecewise/plot-finesser kan komme trinvis.

Før implementering skal Codex kortlægge **eksisterende** OperationSpecs/AST/IR/Value/Worker/DocumentRuntime-grænser og for hver operation kunne dokumentere:

- ejet matematisk betydning, inputvalidering og strukturerede diagnosekoder;
- explicit versionering af betydningsfulde konventioner og `.ncas`-roundtrip, hvor feature kræver persistens;
- korrekt scope, immutable captures, ændringsinvalidering og rehydrering;
- uafhængige RED→GREEN-tests, inklusive virkelige browser/Worker/Pyodide/SymPy-tests ved nye grænseflader;
- ingen legacy-kodegenerering, semantiske UI-genveje eller tavse fallback-beregninger;
- korrekt afgrænsning af beta i forhold til stadig åbne TODO/SKIP, fuld elev-UI, release-allowlist og legacy-retirement.

**Foreslåede minimale acceptscenarier (efter kontraktgates, ikke allerede implementerede tests):**

1. Identiske ugrupperede data i rå liste versus værdier + absolutte hyppigheder giver identiske kvartiler og middelværdi; `n=7/8` tester median-af-halvdele; relative frekvenser `[0.2,0.8]` for `[1,2]` svarer til `Q1=1.5` ved `n=5` og `Q1=2` ved `n=10`; alene giver de diagnose for ikke-entydige kvartiler.
2. To lister kan importeres fra både række- og kolonnetabel; tvetydig tabel kræver valg; ugyldige data efterlader dokumentet uændret; én Undo for vellykket import.
3. Rigt regressionsresultat og modelgenvej giver matematisk samme `FunctionValue` via samme implementering; fitkriterium er deklareret, og `R²` på transformeret skala mærkes; ingen afhængighed af afrundet visning.
4. `X~b(10,0.34)` og `Y~n(5,0.2)` giver korrekt `P`-interval, middelværdi og standardafvigelse. `W~b(9,0.5)` har **to** modalværdier `{4,5}`. `P` accepterer ikke boolesk konstant som hændelse; `b`, `n` og `P` testes mod navnekollisioner.
5. `acceptance(t,0.05)` svarer til den direkte `binom_acceptance(50,0.25,0.05)` **ved samme retning/metode** uanset observeret `k`. Ved `n=50`, `p0=0.25`, `α=0.05` fås `{7,…,19}` (fordoblet mindste hale) kontra `{7,…,18}` (sandsynlighedsordning); ved `k=19` p≈`0.05746632` kontra `0.04812403`. Kritisk mængde defineres med p≤α.
6. Efter domæne-ADR: domæneafgrænset `f` returnerer ikke værdi udenfor og forlænger ikke uafklarede symbolske argumenter stiltiende; `solve` returnerer ikke ugyldige nulpunkter; matematisk analyse kan aflevere dokumenterede åbne endepunkter/huller til plot, uden at simplifikation skjuler huller.
7. Skift af `da-DK`/`dk-3` til andet sprog/ressource ændrer ikke kvartiler, testmetoder, domæner, vinkelenheder eller numeriske Values. Ændring af autoritativ dokumentkonvention invaliderer korrekt; legacy-fil får fast profil. Decimalkomma/kaldseparator roundtrip må ikke ændre betydning.

## 13. Afgrænsede åbne beslutninger og planlagte kontraktgates

**Før berørt slice, ikke som én stor blokering af al beta-udvikling:**

- **P0005 Value-tillæg (D1/D2/D5):** konkrete rige kinds/felter og payload; heltalsmængder, mode og listekvartiler; repræsentation af kædede relationer; præsentationspayload og immutable Worker-rehydrering. Designmålet om fire rige resultater bevares; implementeringsrækkefølgen er separat.
- **P0008 / P0018 (B2/D3/D4/D6/D8):** enum-/option-argumenter eller separate operationer; `X~D` som skriver; navneforrang `b`, `n`, `P`; kædede uligheder; domæneseparator; eksakte decimaler og kanoniske lister/semikolon. Ingen antagelse om at de viste eksempler parses i dag.
- **Persistens-/konventions-ADR (B1/B3/D7/D8):** `fileFormatVersion`, `languageVersion`, `engineVersion`, autoritative dokument-/opgaveindstillinger, legacy-profil, locale-version `dk-3` uden semantisk magt; gennemføring via P0010 `options`; inkrementel invalidation ved konventionsskift.
- **Regression (B4):** fitkriterium og `R²`-grundlag pr. familie, parameternavne, inputdomæner og ikke-understøttede fitmål. Vælges før *den pågældende regressionsimplementering*.
- **Domæne-ADR (B5/D12):** semantisk `FunctionValue`-udvidelse, punktvis og symbolsk anvendelse, real/kompleks, afledte og `solve`-filtrering. Stykkevise funktioner senere.
- **Statistik/test (D9/D10/D13):** hyppighedsvalidering, små datasæt, percentilkonventioner; diskrete fraktiler, tabelfordelinger, direkte fordelingskalds argumentrækkefølge; numerisk eksakthed ved `p=α`.
- **Plot (D11):** hvordan rene evaluatoranalyser kan levere dokumenterede markeringsdata via præsentationsafhængigheder uden ny autoritet; senere ADR-0004-arbejde.
- **Monotonilinje (B6):** *kun senere UI-/pædagogisk undersøgelse*, ingen krævet `monotonilinje(...)`-operation, ingen implicit blokscan-kontrakt i S99.

S99 ændrer **ingen** FROZEN- eller accepterede ADR-dokumenter. Fuld editor, legacy-UI-cutover, offline-studenterpakning, syv eksisterende TODO og Windows-SKIP er fortsat åbne og må ikke omtales som lukket af denne dokumentationsrevision.

**Anbefalet næste proces:** (1) godkend denne dokumentationsrevision og den særskilte reviewdisposition, (2) fastlæg kun den nødvendige ADR/kontrakt for *første valgte matematiske slice*, (3) udfør små Codex RED→GREEN-slices og reelle browser/Worker/Pyodide-gates. **Dette dokument er ikke implementeringsautorisation, releasegodkendelse eller en fuld ny roadmap.**
