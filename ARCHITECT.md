# newCAS – Architect Constitution

## Grundprincipper
- PEG beskriver syntaks.
- Transformer emitterer IR-1 (Python).
- Executor kører IR-1.
- Result producerer IR-2 (JSON).
- Renderer viser IR-2.

## Runtime
- registry.py er Runtime Symbol Table.
- BASE_CONTEXT er det offentlige Runtime API.
- Task Scope indeholder brugerens variabler.
- FORBIDDEN_SYMBOLS beskytter funktionsnavne.

## Udviklingsregler
- Ingen manuel dokumentation af data der kan genereres.
- Ingen opadgående lag-imports.
- Én pass = én commit.
