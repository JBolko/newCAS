# P0021 Slice 17 — Worker-cachekontrol v2

Browsertestens script var versioneret, men Web Workeren og dens import af `selected-pyodide-runtime.js` var ikke. Det kan give en ny browsertest med en gammel evaluator, som kun understøtter `sin`.

Denne rettelse giver både Worker-URL og dens import et entydigt versionsmærke. Ingen ændringer af matematiske kontrakter eller Python.

Verifikation:
1. Udpak i repository-roden.
2. Genindlæs browser-testen med Ctrl+F5 og verificér versionsmærket `slice17-trig-family-v2`.
3. Kør testen. Hvis `cos(60°)` stadig fejler, indsend Worker-konsollens første relevante fejl; årsagen er da ikke alene denne JS-modulcache.

I produktion bør asset-hash i build og en eksplicit cachepolitik løse dette generelt.
