
# Arkitektur og dataflow

## 1. Arkitektoniske designmål

Arkitekturen er designet med fokus på:
- vedligeholdelsesvenlighed
- robusthed
- klar ansvarsdeling
- udvidelsesmuligheder

Nye funktioner skal kunne tilføjes
uden at ændre grammatik eller UI.

## 2. Overordnet lagdeling

Systemet består af følgende lag:

1. Præsentationslag (UI)
2. Syntaktisk lag (preprocessor)
3. Parser og AST
4. Transformationslag
5. Eksekveringslag (CAS-motor)
6. Resultat- og returvej

Data flyder nedad.
Resultater flyder opad.

## 3. Syntaktisk lag (preprocessor)

Omsætter elevvenlig notation til entydig syntaks.

Eksempler:
- 2x -> 2*x
- f'(x) -> derivative(f(x), x)
- X ~ b(n,p) -> stokastisk variabel
- P(X=4) -> sandsynlighedsfunktion

Det er vigtigt, at der ikke er nogen matematik i dette lag - matematikken ligger i eksekveringslaget.

## 4. Parser og AST

Parser implementeret i Peggy (PEG.js) - filen grammatik.pegjs er input til Peggy.

Output er et Abstract Syntax Tree (AST) i ren JSON-struktur.

Typiske nodetyper:
- BinaryExpression
- PowerExpression
- FunctionDefinition
- FunctionCall
- Quantity
- Equation
- Access

AST er uafhÆngig af UI og Python.

## 5. Transformation (AST -> Python)

AST oversættes til SymPy-kompatibel Python-kode.

Eksempler:
- ^ -> **
- ligninger -> Eq(left, right)
- funktioner -> Lambda(...)

Dette lag fungerer som en compiler.

## 6. Eksekvering

Python-koden køres i Pyodide (WebAssembly).

Biblioteker:
- sympy
- sympy.physics.units

Alle beregninger sker lokalt og offline.

## 7. Resultatobjekter

Alle beregninger returnerer strukturerede objekter:
- eksakt værdi
- numerisk værdi
- enhed
- LaTeX-repræsentation
- evt. advarsler
