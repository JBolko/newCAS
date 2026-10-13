# P0021 Slice 17 — valgt trigonometrisk funktionsfamilie

Formål: udvide den eksplicitte Worker allowlist fra `sin` til `sin`, `cos`, `tan` uden nyt Python-scope, registry eller extra Python-moduler. Alle tre eksisterer allerede i P0012 `scalar_trigonometry.py`. Hvert kald kræver `options.angleUnit` = `deg` eller `rad`. `withSelectedAngleUnit` sætter kun indstillingen for disse tre operationer; anden matematik ændres ikke.

Node-kontrakter tester for alle tre kald: eksplicit vinkel, fravær af mutation, afvisning før Python-kald samt at der ikke indlæses flere Python-filer. Browser-smoketesten (`tests/browser/p0021-trig-family-worker-smoke.html`) anvender ny side og versionsmærket modul-URL for at undgå den kendte cacheforveksling. Den prøver 2+3*4, sin(0), sin(38°), cos(60°), tan(45°), cos(0 rad), sin(90°).

Afgrænsning: Kun eksplicit valgte `probe.scalar.{add,multiply,sin,cos,tan}`; ikke generisk dynamisk import, ikke kildekodeeval i Python, ikke generelle AST'er eller DocumentRuntime. Eksakte resultater valideres. Browser-accept kræver konkret kørsel hos udvikler; Node-testene alene beviser ikke Pyodide.
