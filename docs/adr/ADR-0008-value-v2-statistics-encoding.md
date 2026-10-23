# ADR-0008 — eksplicit Value v2 og stabil StatisticsValue

**Status: Accepted — repræsentation, encoding, nesting, metadata, lighed og codecdiagnoser.**
**Acceptdato: 23. oktober 2026.** Grundlag: brugerens eksplicitte S100m1-instruktion. Implementeringstilladelsen gælder kun S100m1; S100m2 kræver gennemgang af resultatet.
Dato: 22. oktober 2026. Kontrolleret basis: `462deb0381ea5b624cd9ad41ceb06dd4069fcc58`, `architecture-v1-implementation`.

## Kontekst og myndighed

Brugeren har accepteret retningen med én StatisticsValue, varianterne grouped-data/statistical-result og eksplicit v2 ved siden af uændret v1. Dansk højrelukket klassekonvention og `piecewise-uniform-cdf/v1` er accepteret matematik. Det præcise stabiliserede repræsentationsschema er nu accepteret i [P0005 Value v2-tillægget](../architecture/P0005-value-v2-statistics-contract.md).

P0005 v1 og den faktiske codec er rekursivt v1-only. P0010 har præcise envelopes, ikke fri estimat-sidecar. FROZEN §§14/25–26 kræver typed immutable Values og stateless evaluator; accepted ADR-0004/-0006 placerer dokumentautoriteten hos DocumentRuntime, ADR-0005 bevarer historiske snapshots. Ingen af disse dokumenter omskrives her.

Det første S100m-udkast bandt encodingen til rationale median-/kvartilresultater fra én metode. Det ville kræve ændret Value-schema ved symbolsk standardafvigelse, approksimation eller transformationer. Denne beslutning erstatter den afgrænsning med [det stabiliserede S100m-kontraktforslag](../architecture/P0005-statistics-value-contract-proposal.md), hvis §3 er det præcise schema.

## Beslutning

1. **Versioneret union:** Bevar P0005 v1, alle gamle factories/bytes og hele dens rekursion. Tilføj Value v2 med kind statistics og præcis de to disjunkte varianter samt ListV2. Ingen intern schemaVersion: valueVersion fastlægger strukturen; metode-id/version fastlægger matematikken.
2. **Generel nesting:** ListV2 må indeholde enhver accepteret v1/v2-Value rekursivt, også tomme/rent-v1-lister. V1-containere tillader fortsat kun v1-descendenter. Selected list producerer fortsat v1 for rene v1-inputs og v2 ellers; gyldighed afhænger ikke af dette minimale producentvalg. Decode nedgraderer aldrig deklareret v2. Andre v2-kinds er ikke implicit indført.
3. **Grouped-data:** Obligatorisk interval-grouped-variant med komplette klasserecords: eksakte rationale v1-grænser, eksplicitte endpointflags og ikke-negative v1-integer-counts som strenge. Nulklasser og counts over 2^53 bevares. Ingen valideringsmarkør, gemte beregnede totals eller backendreferencer.
4. **Generelt resultat:** Statistical-result har præcis variant, statisticId, methodId, estimand, arithmetic, estimateStatus, assumptions, provenance og value. Payload er en fuldt gyldig eksisterende v1-Value; ikke formatteret tekst, vilkårlig JSON eller en skjult statistikwrapper. Dette genbruger typed expression/list/vector/matrix/quantity og øvrige eksisterende v1-kinds; hver metode skal indsnævre den faktiske outputform.
5. **Uafhængige statusakser:** Arithmetic er exact/approximate; estimateStatus er known/estimated relativt til deklareret estimand og datagrundlag. Eksakt symbolsk rod kan være et statistisk estimat; et numerisk approksimeret empirisk mål er ikke automatisk et statistisk estimat. Precision ligger i eksisterende approx-Value, ikke en ny taltype.
6. **Streng proveniens:** Provenance er en ikke-tom ordnet inputs-liste af præcise role/typed-Value-records med unikke roller. Basis, tidligere statistical-results og betydningsbærende parametre er komplette immutable snapshots. Transformationer kræver egen accepteret metode/propagation; ingen skalering/udpakning må miste historikken. Proveniens er ikke dokumentautoritet, eksekverbar replay-plan eller korrekthedscertifikat.
7. **Åbne id'er, eksplicitte metodekontrakter:** Codec kontrollerer schema og id-syntaks, ikke en lukket operationsliste. Matematiske producenter/forbrugere registrerer versionsbestemte input-/output-/estimand-/status-/antagelses-/diagnosekontrakter i den eksisterende Python-evaluator. Ukendte velformede metoder kan decode/lagres/transporteres opakt, men ikke udføres, scalarprojiceres eller fortolkes som en kendt default. P0008 vælger stadig operation/evaluator eksplicit; resultmetadata starter aldrig dispatch eller kodehentning.
8. **Laggrænser:** JS-codec ejer struktur, canonical encoding og freeze. Python/SymPy ejer numeriske grænser, partitioner, hyppigheder og beregning. P0010 bærer hele Value; DocumentRuntime bruger almindelig binding/invalidation/publicering. UI præsenterer uden at ændre flags/status/metode. Ingen ny evaluator, JS-statistik, legacy-fallback eller sidecar.
9. **Transport:** Bevar P0010 request/outcome-versioner og præcise felter; et accepteret tillæg binder Value til den nye union. Opgrader relevante JS-/Worker-/Python-Valuechecks og rehydrering samlet. Ukendt encoding/variant afvises struktureret; malformed Worker-response bevarer INVALID_WORKER_VALUE-kontrakten. Trusted codecfejl bruger almindelig P0009/failure-vej, ikke tekstmatch.
10. **Encoding og lighed:** V2-records har fast feltrækkefølge efter kontraktforslaget; assumptions-id'er er unikke og strengsorteres. Øvrige arrays og embedded v1-encoding bevares. Canonical repræsentationslighed omfatter hele provenance, metode, estimand, status og payload; den erstatter ikke matematisk ækvivalens.

## Versions- og udvidelsespolitik

| Ændring | Konsekvens |
| --- | --- |
| Inkompatibel ændring af eksisterende encoding, field-shape eller discriminatorbetydning | Ny accepteret Value-version; aldrig stiltiende omfortolkning af v1/v2. |
| Ny metode/operation med inputs og outputs inden for schemaet | Ny registreret og testet producent-/forbrugerkontrakt samt eksplicit OperationSpec; ingen ny Value-version. Ændret metodebetydning kræver nyt metode-id/version. |
| Nyt matematisk domæne | Særskilt producentaccept og tests. Kun hvis repræsentationen ikke rummes i schemaet, opstår en yderligere encodinggate. |
| Dokumentformat/profil/persistens | Særskilt versions-/migrationskontrakt, ikke lig med Value-version eller metodeversion. |
| UI-sprog/notation | Præsentation; ingen ændring af eksisterende matematisk betydning. |

Gamle v1-decodere forventes ikke at læse v2. Ingen skjult downgrade eller automatisk genberegning af historiske dokumenter. Metoderegistrering må ikke ændre en gammel Values lagrede metadata eller blive genopslag i en aktuel dokumentdefault.

## Stresstest og alternativer

S100m-forslagets §8 gennemgår alle seks scenarier. Modelkvartiler [35/3,20,30], symbolsk standardafvigelse sqrt(409)/2, forskellige baser/metoder med samme tal og afledte estimater passer alle uden yderligere Value-version. Store counts/flags/nulklasser og uændrede v1-dokumenter bevares. Standardafvigelses-/transformationsmetoder er dermed repræsenterbare, ikke automatisk matematisk accepterede eller implementerede.

Et lukket median-/kvartilschema afvises som for snævert. En fri metadata-pose afvises som uvaliderbar. V2-lister begrundet alene i en enkelt transporttest erstattes af en generel nestingregel; v2-listens tomme/rent-v1-former er ikke længere ugyldige. En fuld ny familie af numeriske typer eller en generel provenance-graf med eksterne id'er er ikke nødvendig for de afprøvede scenarier.

## Anbefaling, acceptgate og næste slices

**ACCEPTED repræsentationskontrakt, endnu ingen implementerings-GREEN.** Der er ikke fundet behov for brud på FROZEN's typed/stateless arkitektur eller v1-betydning. Næste statistikfunktioner kan tilføjes via producentkontrakter uden nye særtilfælde i motorlagene. Dette accepterer kontrakten, men er ikke produktions-GREEN eller bevis for endnu uimplementeret v2-Workertransport.

Accepten omfatter det stabiliserede repræsentationsschema/nesting, metodegrænse, status/proveniens, encoding/lighed og codecdiagnoseproducenter. P0010-Value-bindingen implementeres først samlet i S100m2. Brugeren har efterfølgende 23. oktober 2026 accepteret de generelle v2-codecbudgetter: dybde 128, 100.000 JSON-nodeforekomster og 8 MiB canonical UTF-8 samt P0009 `value-codec-resource-limit` med `{path,resource,limit}`. Se tillæggets §5 for opgørelse og preflight. Top-level v1 bevares. Konkrete grouped-domæneregler, public konstruktor, metodebindings-id'er, estimattransformationer, dokumentprofil/persistens, yderklasser og rendering er fortsat særskilte gates.

**S100m1:** JS-/Python-codecs og canonical fixtures; RED for begge varianter, generel v2-nesting, bevaret rekursiv v1, ukendte id'er som opaque data, radikal/approx, counts/flags, provenance, strict shape og freeze. **S100m2:** eksisterende typed grænser/list-handler og rigtig Worker/Pyodide-roundtrip i begge retninger; generisk DocumentRuntime-publicering/providerbinding, task-isolation, invalidation og stale-result-afvisning. Ingen ny statistisk algoritme eller runtimeautoritet. Præcis filafgrænsning og RED-/acceptplan står i S100m-forslagets §10.

Brugerens S100m1-instruktion autoriserer nu codecs, men ingen Worker/gateway/DocumentRuntime-ændring, matematisk producent, FROZEN-ændring, staging, commit eller push. Hvis implementering senere viser en ny normativ konflikt, skal den fremlægges som separat versionsbeslutning.
