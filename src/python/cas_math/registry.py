"""
Registry — samler alle CAS-matematikmoduler og eksponerer build_context().

Ansvar:
  - Importere calculus, statistics, distributions
  - Registrere funktioner i _REGISTRY og _FORBIDDEN
  - Eksponere build_context() til core/context.py

Designregel: INGEN funktionsimplementeringer her.
  Al logik hører hjemme i det respektive modul.
  registry.py er udelukkende et registreringsled.

SymPy indlæses fuldt øverst med eksplicitte aliaser for at undgå
navnekonflikter og potentielle cirkulære referencer ved runtime.
"""

# ── SymPy — fuldt indlæst øverst ──────────────────────────────────────────────
# Eksplicitte aliaser sikrer at ingen af vores registrerede funktionsnavne
# skygger for SymPy-objekter vi evt. har brug for i dette modul.
import sympy as _sp

# ── Standardbibliotek ─────────────────────────────────────────────────────────
# (ingen — registry.py behøver ikke math/os/etc. direkte)

# ── Interne moduler — importeres i afhængighedsorden ─────────────────────────
# Rækkefølgen er: uafhængige blade først, registry sidst.
# Ingen af de tre moduler importerer fra hinanden → ingen cirkulære referencer.
from . import calculus
from . import statistics
from . import distributions


# ─── INTERN REGISTRERINGSSTRUKTUR ─────────────────────────────────────────────

_REGISTRY: dict  = {}
_FORBIDDEN: set  = set()


def _reg(name: str, func, *, forbidden: bool = True) -> None:
    """
    Registrerer én funktion.
    forbidden=True (default) markerer navnet som beskyttet mod
    auto-symbol-oprettelse i executor.py.
    """
    _REGISTRY[name] = func
    if forbidden:
        _FORBIDDEN.add(name)


def build_context() -> tuple[dict, set]:
    """
    Returnerer (registry_dict, forbidden_set) til core/context.py.
    Returnerer kopier så _REGISTRY ikke kan muteres udefra.
    """
    return _REGISTRY.copy(), _FORBIDDEN.copy()


# ─── CALCULUS ─────────────────────────────────────────────────────────────────

_reg('diff',      calculus.diff)
_reg('integrate', calculus.integrate_cas)
_reg('limit',     calculus.limit)
_reg('arclength', calculus.arclength)


# ─── STATISTIK ────────────────────────────────────────────────────────────────

_reg('mean',   statistics.mean)
_reg('median', statistics.median)
_reg('Q1',     statistics.Q1)
_reg('Q3',     statistics.Q3)
_reg('min',    statistics.min_func)
_reg('max',    statistics.max_func)

_reg('linReg', statistics.linReg)
_reg('expReg', statistics.expReg)
_reg('powReg', statistics.powReg)
_reg('logReg', statistics.logReg)


# ─── FORDELINGER ──────────────────────────────────────────────────────────────

# Binomial
_reg('binompdf', distributions.binompdf)
_reg('binomcdf', distributions.binomcdf)
_reg('mean_B',   distributions.mean_B)
_reg('var_B',    distributions.var_B)
_reg('std_B',    distributions.std_B)
_reg('binomtest',  distributions.binomtest)
_reg('chi2gof',    distributions.chi2gof)
_reg('chi2ind',    distributions.chi2ind)
_reg('ttest1',     distributions.ttest1)
_reg('ttest2',     distributions.ttest2)

# Poisson
_reg('poissonpdf', distributions.poissonpdf)
_reg('poissoncdf', distributions.poissoncdf)
_reg('mean_Po',    distributions.mean_Po)
_reg('var_Po',     distributions.var_Po)
_reg('std_Po',     distributions.std_Po)

# Normal
_reg('normpdf', distributions.normpdf)
_reg('normcdf', distributions.normcdf)
_reg('invnorm', distributions.invnorm)
_reg('mean_N',  distributions.mean_N)
_reg('var_N',   distributions.var_N)
_reg('std_N',   distributions.std_N)
