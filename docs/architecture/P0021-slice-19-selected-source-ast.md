# P0021 Slice 19 — Peggy AST → selected Semantic IR

Dette er en *ren AST-adapter*, ikke en ny parser. Kald med AST fra eksisterende `parser.mjs` og en **eksplicit** `Map<operationId, OperationSpec>`. Ingen registrering i Python; ingen semantiske opslag på tekst alene uden godkendt OperationSpec.

Understøttet: ikke-negative safe integers, `+`, `*`, `^`, samt generiske funktionskald med udelukkende value-roller og eksakt aritet.

Bevidst udskudt: decimaler (Peggy `parseFloat` taber leksikalsk præcision), negative tal/unære operatorer, symbolske variabler og provider-bindinger, funktioner med scoped/symbolic roller, `-` og `/`, flere statements. For disse afvises AST eksplicit. Den eksisterende generelle OperationSpec-katalogfunktion i P0008 omfatter ikke automatisk alle P0012-handlers: kaldende lag leverer sit eksplicitte katalog.

En browser-test med **rigtig parser og Worker** skal komme i næste slice, når vi har verificeret den seneste runtime-opsætning. Node-testene her bruger samme **AST-former** som Peggy, men en håndbygget AST-fixture; de verificerer ikke den faktiske parserkørsel.

Test: `node --test tests/js/p0021-selected-source-ast.test.mjs` og derefter `node --test`.
