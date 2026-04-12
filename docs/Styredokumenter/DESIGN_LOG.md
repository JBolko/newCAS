# 📔 newCAS - Design Decision Log

Dette dokument er projektets hukommelse. Her logges pædagogiske valg, tekniske beslutninger og arkitektoniske overvejelser.

## 🏗️ Overordnede Principper
- **Lokal eksekvering:** Alt kører i browseren (Pyodide/SymPy) – ingen serveromkostninger, maksimalt privatliv[cite: 532, 743].
- **Dansk Matematik:** Systemet skal understøtte danske standarder (f.eks. komma som decimalseparator og specifikke kvartilsæt)[cite: 745, 746].
- **UI/UX (Notebook-model):** Vi følger "Assignment -> Cell"-modellen fra Mathbook for at skabe et intuitivt workflow for eleven.

## ⚙️ Tekniske Valg
- **Parser:** Peggy.js (PEG) for en deterministisk og robust matematik-parsing[cite: 528, 736].
- **Engine:** SymPy via Pyodide for fuld symbolsk CAS-kraft i browseren[cite: 530, 742].
- **Web Worker:** (Beslutning 06.04.2026) Motoren flyttes til en Web Worker for at undgå at UI fryser under beregning[cite: 618, 621, 623].
- **Storage:** localStorage bruges til elev-indstillinger og præferencer[cite: 639, 642].

## 📅 Log
- **2026-04-06:** Beslutning om at genbruge UI/UX principper fra Mathbook-projektet (Notebook-struktur og Assignments).
- **2026-04-06:** Prioritering af "Struktureret JSON-output" som fundament for det videre arbejde[cite: 534, 845, 889].