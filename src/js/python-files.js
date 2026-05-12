/**
 * python-files.js
 * Eneste kilde til listen af Python-filer der skal indlæses i Pyodide-FS.
 *
 * Importeres af:
 *   - cas-engine.js  (produktionskode)
 *   - test-e2e.html  (testsuite)
 *
 * Regel: Tilføj ny .py-fil HER — og kun her.
 * Alle filer er relative til `src/python/`.
 *
 * Rækkefølge er ligegyldig (alle fetches kører parallelt),
 * men grupper gør listen letlæselig og let at vedligeholde.
 */
export const PYTHON_FILES = [
    // Indgangspunkter
    '__init__.py',
    'bootstrap.py',

    // cas_math — matematikregistret og alle undermoduler
    // registry.py importeres af core/context.py
    // calculus, statistics, distributions importeres af registry.py
    'cas_math/__init__.py',
    'cas_math/registry.py',
    'cas_math/calculus.py',
    'cas_math/statistics.py',
    'cas_math/distributions.py',

    // core — exekveringsmotor og scope
    'core/__init__.py',
    'core/context.py',
    'core/executor.py',
    'core/scope.py',

    // output — resultat- og fejlformatering
    'output/__init__.py',
    'output/errors.py',
    'output/result.py',

    // units — enhedsdefinitioner og konvertering
    'units/__init__.py',
    'units/convert.py',
    'units/definitions.py',
];
