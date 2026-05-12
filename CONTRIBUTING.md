# 🤝 Contributing to newCAS

> *"Et CAS-system bygget af fællesskabet, for fællesskabet."*

Tak fordi du overvejer at bidrage til **newCAS**! 🎉  
Uanset om du er studerende, underviser, hobby-udvikler eller erfaren ingeniør – der er plads til dig her. Vi tror på, at god teknologi vokser, når mange perspektiver mødes.

Ingen bidrag er for småt. En rettet stavefejl, en ny enhed, en bedre fejlmeddelelse – det hele gør en forskel.

---

## 🚀 Kom hurtigt i gang

### Første gang? Start her:
1. **Fork** dette repository til din egen GitHub-konto
2. **Clone** din fork lokalt:
   ```bash
   git clone https://github.com/DIT_BRUGERNAVN/newCAS.git
   cd newCAS
   ```
3. **Opret en branch** til din ændring:
```bash
git checkout -b feature/min-nye-funktion
```
4. **Lav dine ændringer** – se Hvad kan jeg bidrage med?
 nedenfor
5. **Test lokalt:** Åbn index.html i din browser (ingen build nødvendig!)
6. **Commit og push:**
```bash
git add .
git commit -m "feat: tilføj [mph] som understøttet enhed"
git push origin feature/min-nye-funktion
```
7. **Åbn en Pull Request** – beskriv kort, hvad du har lavet, og hvorfor

## 🎯 Hvad kan jeg bidrage med? ##
Vi har brug for mange typer hjælp – ikke kun kode:

***

## 🏗️ Forstå koden – kort overblik
``
newCAS/
├── src/js/          # Frontend-logik (ES6 moduler)
│   ├── parser.mjs   # Auto-genereret fra Grammatik.pegjs
│   ├── transformer.js  # AST → Python (SymPy)
│   ├── cas-engine.js   # Pyodide-kommunikation
│   └── renderer.js     # KaTeX-visning
│
├── src/python/      # SymPy-udvidelser (kører i browseren!)
│   ├── bootstrap.py    # Entrypoint
│   ├── cas_math/       # Matematiske funktioner
│   └── units/          # Enhedsdefinitioner
│
├── docs/            # Dokumentation (på dansk & engelsk)
│   ├── Grammatik.pegjs      # Parser-regler
│   └── Styredokumenter/     # Arkitektur, roadmap, design
│
└── *.html           # Test-filer – åbnes direkte i browser`
```

### Dataflow (forenklet):
```text
Brugerinput 
   → Parser (Peggy) → AST 
   → Transformer → Python-string 
   → Pyodide/SymPy → Resultat 
   → Renderer (KaTeX) → Visning
```
📖 Læs mere i ``docs/Styredokumenter/Arkitektur_og_dataflow.md``

## 🛠️ Tekniske retningslinjer ##
### Kode-stil ###

**JavaScript:** Brug ES6-moduler (``import/export``), ``const/let`` frem for ``var``, semikolon, semikoloner valgfrie men konsistente
**Python:** Følg ``PEP 8``
, brug type-hints hvor det giver mening
**Navngivning:** ``camelCase`` til JS-funktioner, ``snake_case`` til Python, beskrivende variable (``userInput`` frem for x1)

### Commit-meddelelser (valgfrit, men værdsat) ###
Vi bruger en let version af ``Conventional Commits``

```text
feat: tilføj understøttelse for komplekse tal
fix: ret fejl ved division med nul i parseren
docs: opdater README med nye installationstrin
test: tilføj edge-cases for kvadratrødder
```
### Tests ###
- Tilføj gerne tests, når du tilføjer ny funktionalitet
- Kør test-e2e.html i browseren for at sikre, at hele pipeline virker
- Ingen test-framework kræves – vi bruger simple <script>-tags for at holde det lav-tærskel

### Parser-opdateringer ###
Hvis du ændrer ``Grammatik.pegjs`` eller ``docs/Grammatik.pegjs``, skal du regenerere ``parser.mjs``:
```bash
# Installer Peggy én gang (hvis ikke allerede gjort)
npm install -g peggy

# Generer parser
peggy --format es docs/Grammatik.pegjs -o src/js/parser.mjs
```
## ❓ Spørgsmål? Usikkerhed? Ideer? ##
Vi ved, at det kan føles overvældende at bidrage til et nyt projekt. Derfor:

    🗨️ **Spørg i en Issue** – ingen spørgsmål er for "dumme"
    💬 **Brug diskussioner** – ``GitHub Discussions``
     er til idéer, spørgsmål og uformel snak
    **Dansk eller engelsk** – skriv på det sprog, du er mest komfortabel med. Vi oversætter gerne internt.
    🙋 **Mentorskab** – mærk dit issue med ``help wanted`` eller ``mentorship available``, hvis du gerne vil have guidet hjælp

    *"Jeg vidste ikke, hvor jeg skulle starte – men en hurtig kommentar fra maintainers fik mig i gang. Nu har jeg bidraget til tre features!"
    – (Plads til dit citat her, når første bidragsyder deler sin oplevelse 😉)*
## 🌱 Vores løfter til dig som bidragsyder ##
✅ **Respektfuld feedback:** Vi reviewer kode, ikke personer. Konstruktiv kritik altid.
✅ **Gennemsigtighed:** Beslutninger om arkitektur diskuteres åbent i Issues/Discussions.
✅ **Anerkendelse:** Alle bidragsydere nævnes i ``README.md`` og release-notes.
✅ **Læring først:** Vi foretrækker at guide dig til selv at løse det – men vi springer ikke over, hvor gærdet er lavest.
✅ **Ingen "gatekeeping":** Erfaring er velkommen, men ikke et krav. Nysgerrighed er det vigtigste.
## 🧭 Roadmap & prioriteringer ##
Se ``docs/roadmap.md`` for at se, hvad vi arbejder på lige nu.
Issues mærket med ``priority: high`` er særligt vigtige – men vi siger aldrig nej til gode idéer uden for planen!
## 📜 Adfærdskodeks ##
Dette projekt følger ``Contributor Covenant v2.1``
.
Kort sagt: Vær venlig, vær inkluderende, vær nysgerrig.
.
## 🙏 Tak ##
newCAS eksisterer, fordi mennesker deler deres tid, viden og entusiasme.
Uanset om du retter en tastefejl eller arkitekterer en ny modul **– du gør en forskel.**
Velkommen til fællesskabet. 🚀
*Med venlig hilsen,
Jakob & newCAS-maintainers*