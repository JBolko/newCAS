"""
Sandsynlighedsfordelinger — diskrete og kontinuerte.
Plain functions — registreres af registry.py

Designregel: Ingen imports fra cas_math. Ingen decorators.

Implementeret i ren Python/math uden NumPy/SciPy-dependency.
Klar til at byttes ud med scipy.stats når Fase 2 nås (jf. roadmap).
"""

import math


# ─── INTERNE KONVERTERINGSHJÆLPERE ────────────────────────────────────────────

def _to_float(x):
    """SymPy-objekt eller tal → Python float."""
    try:
        return float(x.evalf()) if hasattr(x, 'evalf') else float(x)
    except Exception:
        return 0.0


def _to_int(x):
    """SymPy-objekt eller tal → Python int (via evalf for SymPy-typer)."""
    try:
        return int(x.evalf()) if hasattr(x, 'evalf') else int(x)
    except Exception:
        return 0


def _binom_coeff(n, k):
    """Binomialkoefficient C(n, k) — beregnet uden overflow via iterativ metode."""
    if k < 0 or k > n:
        return 0
    if k == 0 or k == n:
        return 1
    k = min(k, n - k)          # udnyt symmetri: C(n,k) = C(n, n-k)
    result = 1
    for i in range(k):
        result = result * (n - i) // (i + 1)
    return result


# ─── BINOMIALFORDELING ────────────────────────────────────────────────────────

def binompdf(k, n, p):
    """P(X = k) for X ~ B(n, p)."""
    k = _to_int(k)
    n = _to_int(n)
    p = _to_float(p)
    if k < 0 or k > n or not (0.0 <= p <= 1.0):
        return 0.0
    return float(_binom_coeff(n, k) * (p ** k) * ((1 - p) ** (n - k)))


def binomcdf(k, n, p):
    """P(X ≤ k) for X ~ B(n, p)."""
    k = _to_int(k)
    n = _to_int(n)
    p = _to_float(p)
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    return float(sum(binompdf(i, n, p) for i in range(k + 1)))


def mean_B(n, p):
    """E(X) = n·p  for X ~ B(n, p)."""
    return float(_to_int(n) * _to_float(p))


def var_B(n, p):
    """Var(X) = n·p·(1−p)  for X ~ B(n, p)."""
    n_val = _to_int(n)
    p_val = _to_float(p)
    return float(n_val * p_val * (1 - p_val))


def std_B(n, p):
    """Std(X) = √(n·p·(1−p))  for X ~ B(n, p)."""
    return math.sqrt(var_B(n, p))


# ─── POISSONFORDELING ─────────────────────────────────────────────────────────

def poissonpdf(k, lam):
    """P(X = k) for X ~ Po(λ)."""
    k   = _to_int(k)
    lam = _to_float(lam)
    if k < 0 or lam <= 0:
        return 0.0
    return float((lam ** k) * math.exp(-lam) / math.factorial(k))


def poissoncdf(k, lam):
    """P(X ≤ k) for X ~ Po(λ)."""
    k   = _to_int(k)
    lam = _to_float(lam)
    if k < 0:
        return 0.0
    return float(sum(poissonpdf(i, lam) for i in range(k + 1)))


def mean_Po(lam):
    """E(X) = λ  for X ~ Po(λ)."""
    return float(_to_float(lam))


def var_Po(lam):
    """Var(X) = λ  for X ~ Po(λ)."""
    return float(_to_float(lam))


def std_Po(lam):
    """Std(X) = √λ  for X ~ Po(λ)."""
    return math.sqrt(_to_float(lam))


# ─── NORMALFORDELING ──────────────────────────────────────────────────────────

def _normal_cdf_approx(z):
    """
    Approksimation af Φ(z) = P(Z ≤ z) via Abramowitz & Stegun (7.1.26).
    Maks. absolut fejl: ca. 7.5 × 10⁻⁸.
    """
    if z == 0.0:
        return 0.5
    p  = 0.2316419
    b1, b2, b3, b4, b5 = 0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429
    t  = 1.0 / (1.0 + p * abs(z))
    poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))))
    tail = 0.39894228 * math.exp(-z * z / 2.0) * poly
    return 1.0 - tail if z > 0 else tail


def normpdf(x, mu, sigma):
    """Sandsynlighedstæthed f(x) for X ~ N(μ, σ²)."""
    x, mu, sigma = _to_float(x), _to_float(mu), _to_float(sigma)
    if sigma <= 0:
        return 0.0
    exponent    = -((x - mu) ** 2) / (2 * sigma ** 2)
    coefficient = 1.0 / (sigma * math.sqrt(2 * math.pi))
    return float(coefficient * math.exp(exponent))


def normcdf(x, mu, sigma):
    """P(X ≤ x) for X ~ N(μ, σ²)."""
    x, mu, sigma = _to_float(x), _to_float(mu), _to_float(sigma)
    if sigma <= 0:
        return 0.0
    return float(_normal_cdf_approx((x - mu) / sigma))


def invnorm(p, mu, sigma):
    """
    Invers normal fordelingsfunktion: find x så P(X ≤ x) = p.

    Initial guess via log-approksimation (korrekte fortegn):
      p < 0.5  →  z < 0  (venstre hale)
      p > 0.5  →  z > 0  (højre hale)
    Raffineres med 6 Newton-Raphson iterationer.
    """
    p, mu, sigma = _to_float(p), _to_float(mu), _to_float(sigma)
    if not (0.0 < p < 1.0) or sigma <= 0:
        return float('nan')
    if abs(p - 0.5) < 1e-12:
        return float(mu)

    # Initial guess — p < 0.5 giver negativ z (venstre hale)
    if p < 0.5:
        z = -math.sqrt(-2.0 * math.log(p))
    else:
        z = math.sqrt(-2.0 * math.log(1.0 - p))

    # Newton-Raphson: z_{n+1} = z_n - (Φ(z_n) - p) / φ(z_n)
    _sqrt_2pi = math.sqrt(2.0 * math.pi)
    for _ in range(6):
        phi = math.exp(-z * z / 2.0) / _sqrt_2pi      # φ(z) — tæthed
        if abs(phi) < 1e-14:
            break
        z -= (_normal_cdf_approx(z) - p) / phi

    return float(mu + sigma * z)


def mean_N(mu, sigma):
    """E(X) = μ  for X ~ N(μ, σ²)."""
    return float(_to_float(mu))


def var_N(mu, sigma):
    """Var(X) = σ²  for X ~ N(μ, σ²)."""
    return float(_to_float(sigma) ** 2)


def std_N(mu, sigma):
    """Std(X) = σ  for X ~ N(μ, σ²)."""
    return float(_to_float(sigma))


# ─── HYPOTESETEST ─────────────────────────────────────────────────────────────

def _fmt_p(p):
    """Formattér sandsynlighed pænt: 0.05 → '0,05', 0.0059 → '0,0059'."""
    return f"{p:.4g}".replace('.', ',')


def _set_str(low, high, max_explicit=8):
    """
    Returner menneskelig repræsentation af en heltalsmængde [low..high].
    {5, 6, 7}  hvis ≤ max_explicit elementer, ellers  {5, 6, ..., 15}
    """
    if low > high:
        return '∅'
    count = high - low + 1
    if count <= max_explicit:
        return '{' + ', '.join(str(k) for k in range(low, high + 1)) + '}'
    return '{' + str(low) + ', ' + str(low + 1) + ', …, ' + str(high) + '}'


def binomtest(x, n, p0, *args):
    """
    Binomialtest  H₀: p = p₀

    Syntaks:
        binomtest(x; n; p0)                  → tosidet, α = 0,05
        binomtest(x; n; p0; alpha)            → tosidet, brugerdefineret α
        binomtest(x; n; p0; less)             → venstresidet H₁: p < p₀, α = 0,05
        binomtest(x; n; p0; greater)          → højresidet  H₁: p > p₀, α = 0,05
        binomtest(x; n; p0; less; alpha)      → venstresidet med brugerdefineret α
        binomtest(x; n; p0; greater; alpha)   → højresidet  med brugerdefineret α

    Returnerer dict med type='hypothesis_test' klar til renderer.js.
    """
    x_obs = _to_int(x)
    n_val = _to_int(n)
    p0_val = _to_float(p0)

    # ── Parse valgfrie argumenter ─────────────────────────────────────────────
    side  = 'two'
    alpha = 0.05

    for arg in args:
        s = str(arg).lower().strip()
        if s in ('less', 'venstre', 'left'):
            side = 'less'
        elif s in ('greater', 'højre', 'right'):
            side = 'greater'
        else:
            try:
                v = _to_float(arg)
                if 0.0 < v < 1.0:
                    alpha = v
            except Exception:
                pass

    # ── P-værdi ───────────────────────────────────────────────────────────────
    p_left  = binomcdf(x_obs, n_val, p0_val)            # P(X ≤ x)
    p_right = 1.0 - binomcdf(x_obs - 1, n_val, p0_val) # P(X ≥ x)

    if side == 'less':
        p_value = p_left
        h1 = f'p < {_fmt_p(p0_val)}'
    elif side == 'greater':
        p_value = p_right
        h1 = f'p > {_fmt_p(p0_val)}'
    else:
        p_value = min(2.0 * min(p_left, p_right), 1.0)
        h1 = f'p ≠ {_fmt_p(p0_val)}'

    # ── Acceptmængde og kritisk mængde ────────────────────────────────────────
    if side == 'two':
        half = alpha / 2.0
        # k_low: største k med P(X ≤ k) ≤ α/2
        k_low = -1
        for k in range(n_val + 1):
            if binomcdf(k, n_val, p0_val) <= half + 1e-12:
                k_low = k
        # k_high: mindste k med P(X ≥ k) ≤ α/2
        k_high = n_val + 1
        for k in range(n_val, -1, -1):
            if (1.0 - binomcdf(k - 1, n_val, p0_val)) <= half + 1e-12:
                k_high = k

        accept = (k_low + 1, k_high - 1)
        crit_low  = (0, k_low)    if k_low  >= 0       else None
        crit_high = (k_high, n_val) if k_high <= n_val else None

    elif side == 'less':
        # k_crit: største k med P(X ≤ k) ≤ α
        k_crit = -1
        for k in range(n_val + 1):
            if binomcdf(k, n_val, p0_val) <= alpha + 1e-12:
                k_crit = k
        accept    = (k_crit + 1, n_val)
        crit_low  = (0, k_crit) if k_crit >= 0 else None
        crit_high = None

    else:  # greater
        # k_crit: mindste k med P(X ≥ k) ≤ α
        k_crit = n_val + 1
        for k in range(n_val, -1, -1):
            if (1.0 - binomcdf(k - 1, n_val, p0_val)) <= alpha + 1e-12:
                k_crit = k
        accept    = (0, k_crit - 1)
        crit_low  = None
        crit_high = (k_crit, n_val) if k_crit <= n_val else None

    # ── Konklusion ────────────────────────────────────────────────────────────
    reject              = p_value < alpha - 1e-12
    in_critical         = not (accept[0] <= x_obs <= accept[1])
    alpha_pct           = f"{alpha * 100:g}%"
    h0_str              = f'p = {_fmt_p(p0_val)}'

    # Byg menneskelige mængdestrenge
    accept_str = _set_str(accept[0], accept[1])

    crit_parts = []
    if crit_low  and crit_low[0]  <= crit_low[1]:
        crit_parts.append(_set_str(crit_low[0],  crit_low[1]))
    if crit_high and crit_high[0] <= crit_high[1]:
        crit_parts.append(_set_str(crit_high[0], crit_high[1]))
    crit_str = ' ∪ '.join(crit_parts) if crit_parts else '∅'

    return {
        'type':        'hypothesis_test',
        'test_name':   'Binomialtest',
        'side':        side,
        'h0':          h0_str,
        'h1':          h1,
        'x':           x_obs,
        'n':           n_val,
        'p0':          p0_val,
        'alpha':       alpha,
        'alpha_pct':   alpha_pct,
        'p_value':     round(p_value, 6),
        'p_value_fmt': _fmt_p(p_value),
        'accept':      list(accept),
        'accept_str':  accept_str,
        'crit_str':    crit_str,
        'reject_h0':   reject,
        'in_critical': in_critical,
        'conclusion':  'Forkast H₀' if reject else 'Bevar H₀',
    }
