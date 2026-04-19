# Design Decision Log — newCAS
*Dette dokument er projektets hukommelse. Vigtige beslutninger logges her med begrundelse, så de ikke genopfindes eller glemmes.*

---

## Overordnede principper (ændres ikke uden eksplicit beslutning)

- **Lokal eksekvering.** Alt kører i browseren. Ingen serveromkostninger, intet privacyproblem, virker til eksamen uden internetadgang.
- **Dansk matematiknotation.** Komma som decimaltegn, semikolon som argument-separator, grader som standard for vinkler.
- **Motor-først.** Vi implementerer og tester matematikken korrekt, inden vi bygger UI. En funktion der ikke virker er værre end en funktion der ikke eksisterer.
- **Testbekræftelse som sandhedskilde.** En funktion er ikke færdig fordi den virker i browseren — den er færdig når E2E-testsuiten godkender den.

---

## Log

### 2026-04-06
**Beslutning: Notebook-layout frem for enkelt textarea**
Skifte fra ét stort input-felt til celle-baseret notebook-struktur inspireret af Jupyter/Mathbook. Begrundelse: matcher elevernes skriftlige arbejdsform, gør scope-isolation naturlig, og gør det lettere at navigere i lange besvarelser.

**Beslutning: WebWorker-arkitektur**
CASEngine flyttes til en Web Worker for at undgå at UI fryser. Pyodide kan tage 5-40 sekunder at initialisere og SymPy-kald kan tage sekunder ved tunge beregninger. Beslutningen er taget, implementeringen afventer stabil motor (Fase 5 i roadmap).

**Beslutning: localStorage til settings og elev-identitet**
Ingen server, ingen synkronisering. Settings og elev-profil gemmes lokalt med export/import som JSON-fil til maskineskift. Begrundelse: eleverne sidder primært på egne maskiner til eksamen, og en fil-baseret løsning er mere pålidelig end en cloud-løsning der kan fejle.

**Beslutning: Struktureret JSON-output som fundament**
`wrap_result()` returnerer altid `{ type, latex, decimal }`. Begrundelse: giver en klar kontrakt mellem Python-motor og JavaScript-UI, gør det muligt at teste motor-output uafhængigt af rendering, og giver mulighed for fremtidigt at vise mere information (enhed, domæne, advarsel) uden at ændre grænsefladen.

---

### 2026-04-07
**Beslutning: SciPy og NumPy som motor-pakker**
Statistik og regression implementeres via `scipy.stats` og `scipy.optimize` frem for hjemmebyggede approksimationer. Begrundelse: pålidelighed. En elev der laver et binomialtest til eksamen må ikke kunne stole på et forkert resultat pga. en hjemmebrygget implementering. Konsekvens: lidt længere opstartstid (5-8 sekunder ekstra), men 100% korrekte resultater.

**Beslutning: Plotly.js til visualisering frem for Matplotlib**
Matplotlib kan generere billeder i Pyodide, men output er et statisk billede. Plotly giver interaktiv grafik med zoom, koordinat-sporing og eksport — direkte i browseren. Modellen er: Python genererer datapunkter som JSON, Plotly renderer dem. Separationen giver mulighed for at opdatere grafen uden at genkøre Python.

---

### 2026-04-12
**Beslutning: `pi`, `E`, `I`, `oo` eksplicit i `base_context`**
SymPy's matematiske konstanter er ikke callable og filtreres fra af `vars(sympy_module)`-comprehensionen. De skal tilføjes eksplicit, ellers opretter auto-symbol-handleren `Symbol('pi')` i stedet for den rigtige π-konstant. Disse navne tilføjes også til `FORBIDDEN_SYMBOLS`. Fundet via failing trig-tests.

**Beslutning: `decimal`-feltet er altid en numerisk streng**
SymPy's `str(Rational(1,2))` returnerer `"1/2"`. JavaScript's `parseFloat("1/2")` returnerer `1` (stopper ved `/`). `decimal`-feltet i `wrap_result` skal altid returnere `str(float(res))` — aldrig en brøkstreng. Fundet via failing trig-tests.

**Beslutning: `min`/`max` gendannes efter `units_dict`-spread**
`units_dict` har `'min': minute` (minutter). Denne overstyrer `min_func` hvis den spreades ind i `base_context` efter funktionsdefinitionen. Løsning: eksplicit re-definition af `'min': min_func` og `'max': max_func` som det *allersidste* i `base_context`-konstruktionen. `'minute'` tilbydes som separat nøgle.

**Beslutning: `architecture.md` og `Arkitektur_og_dataflow.md` slås sammen**
De to dokumenter overlappede næsten fuldstændigt og var begge forældede. Erstattet af ét nyt, opdateret `Arkitektur_og_dataflow.md (Rev. 120426)`.

**Beslutning: `roadmap.md` og `Strategisk_udviklingsplan.md` slås sammen**
`Strategisk_udviklingsplan.md` repræsenterede vigtige nye beslutninger (SciPy, WebWorker, Plotly) men var skrevet som om projektet startede forfra. `roadmap.md (Rev. 070426)` var forældet med uafkrydsede Fase 1-opgaver der faktisk var færdige. Begge erstattet af `roadmap.md (Rev. 120426)`.

---


### 2026-04-12 (fortsat)
**Beslutning: `.ncas`-filformat som åben JSON**
Dokumenter gemmes som JSON med filendelsen `.ncas`. Begrundelse: åbent format som alle kan læse og bearbejde, ingen vendor lock-in, let at versionere. Output caches i filen så genåbning ikke kræver genberegning. `format`- og `version`-felter er reserveret fra starten til fremtidig migrations-logik.

**Beslutning: `localStorage` som autosave + manuel download som primær lagringsmodel**
Fravalgt: File System Access API (kun Chrome/Edge, ikke Firefox). Fravalgt: cloud-sync (kræver server). Valgt: autosave til localStorage ved hver ændring som sikkerhedsnet, plus eksplicit download som `.ncas`-fil til langsigtet opbevaring. Giver eleven fuld kontrol uden serverafhængighed.

**Beslutning: Drag-and-drop indsætter *efter* fokuseret opgaveblok, ikke forrest**
Begrundelse: eleven har oftest allerede startet sit dokument. Indsætning forrest ville tvinge en omstrukturering. Indsætning efter aktuel opgave er den mest naturlige adfærd og matcher forventningen om at man "tilføjer material bagpå det man er i gang med".

**Beslutning: KaTeX konfigureres med `output: 'htmlAndMathml'` fra starten**
Begrundelse: skærmlæserkompatibilitet (MathML) er et langsigtet tilgængelighedsmål. Det er billigt at sætte dette korrekt nu; dyrt at retrofitte. Ingen synlig forskel for seende brugere.

## Afviste alternativer (med begrundelse)

**MathJax frem for KaTeX:** Fravalgt pga. hastighed. KaTeX er 10x hurtigere og giver deterministisk output. MathJax var inkluderet i de tidlige versioner og er fjernet.

**`from sympy import *` som ren løsning:** Bevaret i `setup.py` men indrammnet. `from sympy import *` er nødvendigt for at få alt, men det forurener navnerummet. Afbødet ved eksplicit genoprettelse af funktioner (`min_func`, `max_func`) og konstanter (`pi`, `E`) i `base_context`. Fremtidig forbedring: eksplicit import-liste.

**React/Vue til frontend:** Fravalgt. Vanilla ES6 med moduler er tilstrækkeligt til det nuværende scope og undgår et build-step og afhængighedshelvede. Gevinsten ved et framework er ikke tilstrækkelig til at opveje kompleksiteten i dette stadie.

**Server-baseret Python (Flask/FastAPI):** Fravalgt fundamentalt. Offline-first er et ikke-forhandleligt krav. Alle beregninger skal kunne udføres uden internetforbindelse.

---

*Opdateres løbende. Format: dato + beslutning + begrundelse.*
