/**
 * error-catalog.js
 * Oversætter fejlkoder og fejlsituationer til pædagogiske danske beskeder.
 *
 * To typer fejl håndteres:
 *
 *  1. Python-exceptions (result.type === 'error', result.code sættes af classify_error i setup.py)
 *     Disse er egentlige programfejl: division med nul, udefinerede navne osv.
 *
 *  2. Domænefejl (result.type === 'warning', result.code === 'COMPLEX_RESULT')
 *     Matematisk gyldige udtryk der giver komplekse resultater i et reelt domæne:
 *     asin(2), sqrt(-4), log(-1) osv. SymPy kaster ikke fejl — vi detekterer
 *     situationen ved at inspicere result.source (den Python-kode der producerede det).
 *
 *  3. Parse-fejl (Peggy SyntaxError — ikke fra Python)
 *     Har ingen 'code', men har et 'message' fra parseren.
 */

// ─── 1. Python-fejlkoder → dansk tekst ──────────────────────────────────────
// Sættes af classify_error() i setup.py og sendes som result.code.

const PYTHON_ERROR_MESSAGES = {
    ZERO_DIVISION:     () =>
        'Division med nul er ikke defineret.',

    RECURSION:         () =>
        'Beregningen gik i uendelig løkke — tjek om din funktionsdefinition kalder sig selv.',

    OVERFLOW:          () =>
        'Tallet er for stort til at beregne — prøv med et mindre tal.',

    UNDEFINED_NAME:    (msg) => {
        const m = msg?.match(/name '(.+)' is not defined/);
        return m
            ? `'${m[1]}' er ikke defineret i denne opgave — er du sikker på at du har stavet rigtigt?`
            : 'En variabel eller funktion er ikke defineret i denne opgave.';
    },

    TYPE_ERROR:        (msg) => {
        if (msg?.includes('cannot'))
            return 'Forkert type argument — tjek at du bruger tal, ikke tekst eller lister, der hvor det forventes.';
        return 'Forkert argumenttype.';
    },

    SINGULAR_MATRIX:   () =>
        'Matricen er ikke inverterbar — dens determinant er 0.',

    NON_SQUARE_MATRIX: () =>
        'Denne operation kræver en kvadratisk matrix.',

    SYMPY_ERROR:       (msg) => {
        // Forsøg at give lidt mere kontekst baseret på den tekniske besked
        if (msg?.includes('convergence'))
            return 'Beregningen konvergerede ikke — prøv at forenkle udtrykket.';
        if (msg?.includes('not implemented') || msg?.includes('NotImplemented'))
            return 'Denne beregning er ikke understøttet endnu.';
        return 'SymPy kunne ikke beregne dette udtryk — tjek syntaksen.';
    },

    UNKNOWN:           (msg) => {
        console.error('Ukendt CAS-fejl:', msg);
        return 'En uventet fejl opstod — se konsollen for detaljer.';
    },
};

// ─── 2. Domænefejl — regex-klassificering af source-kode ─────────────────────
// Når SymPy returnerer et komplekst tal for input der forventes reelt,
// sender setup.py result.source (den genererede Python-kode).
// Vi bruger regex på denne kode til at give en specifik besked.

const DOMAIN_PATTERNS = [
    {
        // asin(x) med |x| > 1 — argument uden for [-1, 1]
        pattern: /\basin\s*\(/,
        message: () =>
            'arcsin er kun defineret for argumenter i intervallet [−1, 1]. ' +
            'Du har sandsynligvis givet et tal uden for dette interval.',
    },
    {
        // acos(x) med |x| > 1
        pattern: /\bacos\s*\(/,
        message: () =>
            'arccos er kun defineret for argumenter i intervallet [−1, 1]. ' +
            'Du har sandsynligvis givet et tal uden for dette interval.',
    },
    {
        // asin/acos der giver imaginært resultat (fanges ovenstående ikke)
        // asec, acsc uden for [-∞,-1] ∪ [1,∞]
        pattern: /\basec\s*\(|\bacsc\s*\(/,
        message: () =>
            'arcsec og arccsc er kun defineret for |x| ≥ 1.',
    },
    {
        // sqrt af et negativt tal — det faktiske argument er negativt
        // Transformer genererer sqrt((-(...))), sqrt((-4)) eller sqrt(-tal)
        pattern: /\bsqrt\s*\(\s*\(-|\bsqrt\s*\(\s*-[0-9]/,
        message: () =>
            'Kvadratroden af et negativt tal er ikke defineret i de reelle tal. ' +
            'Resultatet er et komplekst tal.',
    },
    {
        // log / ln af nul eller negativt tal
        // Transformer kan generere log(0), log((-5)), log(-5)
        pattern: /\blog\s*\(\s*0|\blog\s*\(\s*\(-|\blog\s*\(\s*-[0-9]/,
        message: () =>
            'Logaritmen er kun defineret for positive tal. ' +
            'log(0) divergerer, og log(x) for x < 0 er kun defineret i de komplekse tal.',
    },
    {
        // log generelt med komplekst resultat (fanger tilfælde regex ovenfor ikke griber)
        pattern: /\blog\s*\(/,
        message: () =>
            'Logaritmen af dette udtryk giver et komplekst resultat — ' +
            'sandsynligvis er argumentet nul eller negativt.',
    },
    {
        // tan nær π/2 + nπ — resultatet er zoo (kompleks uendelighed)
        pattern: /\btan\s*\(/,
        message: () =>
            'tan er ikke defineret for dette argument — ' +
            'sandsynligvis er vinklen et multiplum af 90° (π/2 rad).',
    },
];

/**
 * Klassificerer en domænefejl baseret på den genererede Python-kode.
 * Returnerer en dansk brugerbesked.
 */
function classifyDomainError(sourceCode) {
    if (!sourceCode) {
        return 'Resultatet er et komplekst tal — udtrykket er ikke defineret i de reelle tal.';
    }
    for (const { pattern, message } of DOMAIN_PATTERNS) {
        if (pattern.test(sourceCode)) {
            return message();
        }
    }
    return 'Resultatet er et komplekst tal — udtrykket er sandsynligvis ikke defineret i de reelle tal ' +
           'for de angivne værdier.';
}

// ─── 3. Parse-fejl fra Peggy ─────────────────────────────────────────────────

function classifyParseError(err) {
    const msg = err?.message ?? '';

    // Peggy giver relativt strukturerede fejlbeskeder
    if (msg.includes('Expected') && msg.includes('but'))
        return 'Syntaksfejl: tjek at du har skrevet udtrykket korrekt — ' +
               'muligvis mangler en parentes eller operator.';
    if (msg.includes('end of input'))
        return 'Udtrykket er ufuldstændigt — mangler der noget til sidst?';
    if (msg.includes('";"'))
        return 'Syntaksfejl: husk at adskille argumenter med semikolon (;).';

    // Generisk
    const firstLine = msg.split('\n')[0] ?? msg;
    return `Syntaksfejl: ${firstLine}`;
}

// ─── 4. Offentlig API ────────────────────────────────────────────────────────

/**
 * Returnerer en pædagogisk dansk besked for et fejl- eller advarselsobjekt.
 *
 * Forstår tre typer input:
 *   { type: 'error',   code, message }         → Python-fejl fra setup.py
 *   { type: 'warning', code: 'COMPLEX_RESULT',
 *     source }                                  → Domænefejl (komplekst resultat)
 *   Error-objekt (Peggy SyntaxError)            → Parse-fejl
 */
export function getFriendlyMessage(result) {
    // Parse-fejl: et JavaScript Error-objekt (fra Peggy)
    if (result instanceof Error || (result?.name === 'SyntaxError' && !result?.code)) {
        return classifyParseError(result);
    }

    // Domænefejl: komplekst resultat
    if (result?.code === 'COMPLEX_RESULT') {
        return classifyDomainError(result.source);
    }

    // Python-fejl: kode fra classify_error() i setup.py
    if (result?.code) {
        const handler = PYTHON_ERROR_MESSAGES[result.code]
                     ?? PYTHON_ERROR_MESSAGES.UNKNOWN;
        return handler(result.message);
    }

    // Fallback
    return result?.message ?? 'En ukendt fejl opstod.';
}
