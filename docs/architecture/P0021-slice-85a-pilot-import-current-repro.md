# P0021 Slice 85a — sikker pilotimport og aktuel RED-reproduktion

**Status:** YELLOW samlet. Læs dette før eventuel installation. **Ingen produktionsfiler ændres.**

## Autoritet og kildegrundlag
- Normative: `docs/architecture/v1.0/ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md`, `ARCHITECTURE_STRESS_TESTS_FROZEN_v1.0.md` og `ARCHITECTURE_REVIEW_RESOLUTION.md`.
- Frosne kontrakter ændres ikke. P0018 og P0004 er normative for henholdsvis canonical notation og version.
- Claudes oprindelige `clauderesponse.zip` er forblevet uændret hos brugeren. Denne ZIP kopierer **udelukkende** 11 læste, test-/fixture-filer fra dens 29-filers pilot (ingen `src/`-patch, ingen setup-/downloadscript, ingen Worker-supervisor-prototype).
- Eget aktuelt tillæg: 2 parser-driftsvagter og register med konservativ status for alle 55 normative tests.
- Overfladeaudit: de importerede filer bruger ikke netværk, `child_process`, shell, filskrivning eller `eval`/`exec`. Peggy-checket bygger kun en parser i hukommelsen, hvis Peggy er installeret. F4-testen **genererer kun** Python-kode; den eksekverer den ikke.

## Reproduceret i lokalt snapshot fra 17. oktober 2026
| ID | Alvor | Status | Kontrakt og evidens | Exit |
| --- | --- | --- | --- | --- |
| F1 | HØJ | RED | `02-front-door-robustness`, flersætningskilde får `deriveBlockSourceBindings` til at kaste; kan forgifte senere mutationer. §7.3, §17, §19; stress #14/#41 | Semantisk afledning total; ingen ghost success; hostile fuzz består i strict |
| F2 | HØJ | RED | `02-front-door-robustness`: parse-invalid kilde afvises; tom midterblok gør batch-forberedelse ugyldig. §7.3 og stress #14/#41 | Invalid kilde kan gemmes og diagnosticeres lokalt, øvrige blokke evaluerer |
| F3 | HØJ | RED (adfærd), YELLOW (generator-diff) | Direkte aktiv `parser.mjs` accepterer `x := 0,5` og læser `f(1,5)` som ét argument; `docs/Grammatik.pegjs` er dot-canonical. `s85-current-canonical-parser.test.mjs`; P0018, §28/§31. Regenereret Peggy-sammenligning mangler lokalt Peggy. | Opbyg fra kanonisk grammatik; regeneration/diff- og i18n-grænsetest består |
| F4 | KRITISK/HØJ | RED (kodegenerering) | `05-legacy-injection...`: elevtekst i Unit fører til Python-kodesyntaks via Transformer; `src/python/core/executor.py` har `exec/eval`. UI i `src/js/main.js` anvender legacy CASEngine. §25, sikkerhedsgrænse. **Ingen payload afviklet.** | Sikker afvisning/tilladt enhedsgrammatik i hele legacy entrypoint; senere fjern legacy |
| F5 | HØJ | YELLOW/delvist afhjulpet | Version-gap til 0.26.1 er **ikke** aktuelt: Worker-kilden indeholder CDN `v314.0.7`; timeout/terminate, store resultater og offline stadig åbne for review; ingen faktisk Worker kørsel her. | ægte Worker timeout/restart, ressourcevagt + diagnostik, koldstart adskilt |
| F6 | MELLEM | YELLOW/delvist afhjulpet | S76/83 IR-test og tidligere brugerverificeret Worker viser løst indlejret funktionskald, men Claudes historiske 14 e2e-fails må hverken videreføres eller frikendes samlet uden ny matrix. | Fuld migreret real-Worker-korpus på aktiv IR |
| F7 | MELLEM | RED (binding) | `01-binding-stress` #16/#18 binder operation-lokal dummy forkert; §11, stress #16/#18 | Rollebevidst binding (symbolic/scoped) og e2e |
| F8 | MELLEM | RED/YELLOW | `04-language...`: `|` ikke parset; `1e3` tolkes som `1*e3`; taltekst tabes. §12, §28/31. Implementering udsat. | eksplicit grammatisk design, præcisionsbevarende literals/roundtrip |
| F9 | LAV/MELLEM | RED for hygiejne | `package.json` har stadig `npm test` som echo; indlejrede 3 tests i `test-cas-engine.mjs` annulleres på lokal Node 22; håndholdte `?v=` findes i src/js. Separate mindre oprydningsslices. | aktiv testkommando, ingen skjulte subtests, versionsstyring |
| E1 | PLANLAGT | YELLOW/blocked | EditingSession, undo, cross-task move/duplicate/copy. §19, stress #27/#28/#32/#50/#52/#53. | P0026/P0027 redigeringstransaktioner |

**Sikkerhedsafgrænsning:** En faktisk payload blev *ikke* kørt. Enhedsinjektion er påvist ved sikker kodegenereringsanalyse; en aktiv exploit gennem browser er endnu ikke gennemført. Anvend ikke den legacy UI-kodevej med ikke-betroet elevinput, indtil F4 er lukket.

## 55 normative cases — foreløbig konservativ optælling
`tests/pilot/s85-coverage-registry.mjs` indeholder alle 55 med titel og status:
**binding 18; gap 4; blocked 13; unknown 20; e2e 0.**
Disse statusser beskriver **kun, hvad denne begrænsede pilot har bevist**. Ingen af de ældre Claude-Pyodide-e2e-resultater er overført som nutidige. `unknown` er ikke `FAIL` eller `PASS`.

## Lokal prøvekørsel (rekonstrueret checkout, ikke brugerens maskine)
- Node **v22.16.0** (ikke projektets krævede Node 24), Python **3.13.5**, SymPy **1.14.0**.
- Claude pilot 02+05: **18 registrerede; 4 pass, 14 TODO-fejl** (`todo` må ikke tælles som pass).
- **Slice 85a samlet, nye tests inkluderet** (`01`–`05`, to S85 tests + register): **51 tests; 27 pass, 23 TODO-fejl, 1 skip**; proces exit 0 skyldes udelukkende `knownGap`-semantikken.
- **Slice 85a STRICT (F1/F2/F3/F4/F8)**: **26 tests; 5 pass, 20 reelle RED, 1 skip (Peggy)**; exit 1 som forventet.
- Pilot 00+01+03+04 (12 × 10 fuzz, pilot 00 ikke med i denne ZIP): **35; 26 pass, 8 TODO-fejl, 1 skip** (generator-diff skipper uden Peggy).
- Pilot 09 (audit, ikke importeret): 5; 2 pass, 3 TODO-fejl.
- Tre aktuelle S76-relaterede testfiler: **13/13 pass**.
- Python `unittest discover`: **258/258 pass**, under lokal Python 3.13.5.
- Full JS `node --test tests/js/*.mjs`: **879 pass, 4 failed, 3 cancelled** (886 tests rapporteret); tre testfiler kan ikke loade `peggy`, og 3 underordnede tests i `test-cas-engine.mjs` annulleres på Node 22. **IKKE et produktions-RED for JS-suite på krævet Node 24.**
- Real browser Worker **ikke kørt lokalt**; S83-brugeraccept er tidligere rapporteret, ikke genverificeret i S85.

## Næste iteration
S85b: valgfrie nyere pilot e2e/versions-/Worker-lifecycle-tests (først statisk audit og tilpasning til IR), og evidensbaseret opgradering af 55-registeret. S86 lukker F1/F2 med atomisk dokumentmutation/diagnostik. S87 lukker F4 hurtigst muligt. S88 regenererer kanonisk parser og designer i18n-inputgrænsen. Slices forbliver adskilte.
