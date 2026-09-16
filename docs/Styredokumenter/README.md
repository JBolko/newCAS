# newCAS - Styredokumenter

Dette er indgangen til projektets dokumentation.

## Autoritative dokumenter for den aktuelle kode

1. `ARKITEKTUR_AKTUEL.md` - lag, ansvar og interfaces.
2. `JSON_KONTRAKTER.md` - AST- og outputkontrakter.
3. `FUNKTIONSKATALOG_AKTUEL.md` - funktioner, der faktisk er registreret i `registry.py`.
4. `ROADMAP_AKTUEL.md` - status vurderet ud fra det leverede snapshot.
5. `SYNC_POLICY.md` - regler for at holde kode og dokumentation synkroniseret.

## Historiske designdokumenter

`Formål.md`, `Arkitektur_og_dataflow.md`, `Bruger_interface_og_interaktionsdesign.md`, `DESIGN_LOG.md`, `Funktionskatalog.md`, `roadmap.md` og `units-mapping.md` indeholder vigtig projekt-historik og designintentioner.

De skal ikke bruges som teknisk facit, hvis de afviger fra de fem aktuelle dokumenter ovenfor.

## Grundregel

```text
syntax       = Grammatik.pegjs
API          = cas_math/registry.py
implementation = cas_math/*.py
JSON         = output/result.py + output/errors.py
test truth   = tests / E2E
```
