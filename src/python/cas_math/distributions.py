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


# ─── NUMERISKE HJÆLPEFUNKTIONER TIL KONTINUERTE FORDELINGER ──────────────────
# Implementerer regulariseret ufuldstændig gamma- og betafunktion
# uden NumPy/SciPy — bruges af chi²- og t-fordelinger.

def _gammainc(a, x):
    """
    Regulariseret nedre ufuldstændig gammafunktion P(a, x) = γ(a,x)/Γ(a).
    Bruger seriefremstilling for x < a+1, fortsatte brøker ellers.
    Maks. fejl < 1e-9 for typiske testværdier.
    """
    if x <= 0.0:
        return 0.0
    if x < a + 1.0:
        # Seriefremstilling: P(a,x) = e^{-x} x^a Σ x^n/Γ(a+n+1)
        lga = math.lgamma(a)
        ap, s, d = a, 1.0 / a, 1.0 / a
        for _ in range(300):
            ap += 1.0
            d *= x / ap
            s += d
            if abs(d) < abs(s) * 1e-12:
                break
        return s * math.exp(-x + a * math.log(x) - lga)
    else:
        # Fortsatte brøker (Lentz) → Q(a,x) = 1 - P(a,x)
        FPMIN = 1e-30
        lga = math.lgamma(a)
        b = x + 1.0 - a
        c, d = 1.0 / FPMIN, 1.0 / b
        f = d
        for i in range(1, 300):
            an = -i * (i - a)
            b += 2.0
            d = an * d + b
            if abs(d) < FPMIN: d = FPMIN
            c = b + an / c
            if abs(c) < FPMIN: c = FPMIN
            d = 1.0 / d
            delta = d * c
            f *= delta
            if abs(delta - 1.0) < 1e-12:
                break
        return 1.0 - math.exp(-x + a * math.log(x) - lga) * f


def _betainc(a, b, x):
    """
    Regulariseret ufuldstændig betafunktion I_x(a,b).
    Bruger symmetrirelation + Lentz fortsatte brøker.
    """
    if x <= 0.0: return 0.0
    if x >= 1.0: return 1.0
    # Symmetri: bedre konvergens for x > (a+1)/(a+b+2)
    if x > (a + 1.0) / (a + b + 2.0):
        return 1.0 - _betainc(b, a, 1.0 - x)
    FPMIN   = 1e-30
    lbeta   = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front   = math.exp(math.log(x) * a + math.log(1.0 - x) * b + lbeta) / a
    # Lentz
    f = 1.0; c = 1.0
    d = 1.0 - (a + b) * x / (a + 1.0)
    if abs(d) < FPMIN: d = FPMIN
    d = 1.0 / d; f = d
    for m in range(1, 300):
        for step in (0, 1):
            if step == 0:
                num = m * (b - m) * x / ((a + 2*m - 1) * (a + 2*m))
            else:
                num = -(a + m) * (a + b + m) * x / ((a + 2*m) * (a + 2*m + 1))
            d = 1.0 + num * d
            if abs(d) < FPMIN: d = FPMIN
            c = 1.0 + num / c
            if abs(c) < FPMIN: c = FPMIN
            d = 1.0 / d
            f *= d * c
        if abs(d * c - 1.0) < 1e-12:
            break
    return front * f


def _chi2_cdf(x, df):
    """P(χ² ≤ x | df)."""
    if x <= 0.0: return 0.0
    return _gammainc(df / 2.0, x / 2.0)


def _chi2_ppf(p, df):
    """Invers χ²-CDF: find x med P(χ² ≤ x) = p. Brugt til kritisk værdi."""
    if p <= 0.0: return 0.0
    if p >= 1.0: return float('inf')
    # Wilson-Hilferty approksimation som startgæt
    z  = invnorm(p, 0.0, 1.0)
    h  = 2.0 / (9.0 * df)
    xi = max(df * (1.0 - h + z * math.sqrt(h)) ** 3, 1e-6)
    # Newton-Raphson
    for _ in range(15):
        cdf_val = _chi2_cdf(xi, df)
        # χ²-tæthed: f(x) = x^{k/2-1} e^{-x/2} / (2^{k/2} Γ(k/2))
        log_pdf = (df/2 - 1) * math.log(xi) - xi/2 - (df/2) * math.log(2) - math.lgamma(df/2)
        pdf_val = math.exp(log_pdf)
        if pdf_val < 1e-15: break
        step = (cdf_val - p) / pdf_val
        xi  -= step
        if xi <= 0.0: xi = 1e-6
        if abs(step) < 1e-9: break
    return xi


def _t_cdf(t, df):
    """P(T ≤ t | df) for t-fordeling med df frihedsgrader."""
    if df <= 0: return float('nan')
    x        = df / (df + t * t)            # argument til betafunktion
    half_p   = _betainc(df / 2.0, 0.5, x) / 2.0   # = P(|T| ≥ |t|)/2 · (næsten)
    return (1.0 - half_p) if t >= 0.0 else half_p


def _t_ppf(p, df):
    """Invers t-CDF: find t med P(T ≤ t) = p. Bruges til kritisk værdi."""
    if p <= 0.0: return float('-inf')
    if p >= 1.0: return float('inf')
    if abs(p - 0.5) < 1e-12: return 0.0
    # Startgæt fra normalfordelingen (god for store df)
    t = invnorm(p, 0.0, 1.0)
    # Newton-Raphson
    for _ in range(15):
        cdf_val = _t_cdf(t, df)
        log_pdf = (math.lgamma((df+1)/2) - math.lgamma(df/2)
                   - 0.5 * math.log(df * math.pi)
                   - (df+1)/2 * math.log(1 + t*t/df))
        pdf_val = math.exp(log_pdf)
        if pdf_val < 1e-15: break
        step = (cdf_val - p) / pdf_val
        t   -= step
        if abs(step) < 1e-10: break
    return t


# ─── DELT HJÆLPER: byg hypothesis_test-dict til kontinuerte tests ─────────────

def _ht_continuous(test_name, h0, h1, stat, stat_sym,
                   df, p_value, alpha, side, extra=None):
    """
    Returnerer et hypothesis_test-dict klar til renderer.js.
    Bruges af chi2gof, chi2ind, ttest1, ttest2.
    """
    reject    = p_value < alpha - 1e-12
    alpha_pct = f"{alpha * 100:g}%"
    side_name = {'two': 'Tosidet', 'less': 'Venstresidet',
                 'greater': 'Højresidet', 'right': 'Højresidet'}.get(side, '')
    return {
        'type':          'hypothesis_test',
        'test_name':     test_name,
        'side':          side,
        'side_name':     side_name,
        'h0':            h0,
        'h1':            h1,
        'statistic':     round(stat, 4),
        'stat_sym':      stat_sym,      # 't' eller 'χ²'
        'df':            round(df, 2),
        'p_value':       round(p_value, 6),
        'p_value_fmt':   _fmt_p(p_value),
        'alpha':         alpha,
        'alpha_pct':     alpha_pct,
        'reject_h0':     reject,
        'conclusion':    'Forkast H₀' if reject else 'Bevar H₀',
        **(extra or {}),
    }


# ─── CHI²-TEST ────────────────────────────────────────────────────────────────

def chi2gof(observed, expected, *args):
    """
    Chi²-test (Goodness of Fit): passer fordelingen?
    H₀: data følger den angivne fordeling.

    Syntaks:
        chi2gof({O1;O2;…}; {E1;E2;…})
        chi2gof({O1;O2;…}; {E1;E2;…}; alpha)

    observed og expected kan også angives som relative frekvenser/sandsynligheder
    — de normaliseres automatisk til samme total.
    """
    obs   = [_to_float(v) for v in observed]
    exp   = [_to_float(v) for v in expected]
    alpha = 0.05
    for a in args:
        try:
            v = _to_float(a)
            if 0.0 < v < 1.0: alpha = v
        except Exception:
            pass

    # Normaliser forventede til samme total som observerede
    obs_total = sum(obs)
    exp_total = sum(exp)
    if exp_total > 0 and abs(exp_total - obs_total) > 1e-6:
        scale = obs_total / exp_total
        exp   = [e * scale for e in exp]

    k   = len(obs)
    df  = k - 1
    chi2 = sum((o - e) ** 2 / e for o, e in zip(obs, exp) if e > 0)
    p   = 1.0 - _chi2_cdf(chi2, df)
    chi2_crit = _chi2_ppf(1.0 - alpha, df)

    return _ht_continuous(
        test_name = 'Chi²-test (GOF)',
        h0        = 'Fordelingen passer',
        h1        = 'Fordelingen passer ikke',
        stat      = chi2,
        stat_sym  = 'χ²',
        df        = df,
        p_value   = p,
        alpha     = alpha,
        side      = 'right',
        extra     = {
            'k':           k,
            'crit_value':  round(chi2_crit, 4),
            'crit_fmt':    f"{chi2_crit:.4g}".replace('.', ','),
            'stat_fmt':    f"{chi2:.4g}".replace('.', ','),
        }
    )


def chi2ind(*args):
    """
    Chi²-uafhængighedstest: er to kategoriske variable uafhængige?
    H₀: De to variable er uafhængige.

    Input: én rækkevektor per række i kontingenstabellen.
    Syntaks:
        chi2ind({r1k1; r1k2; …}; {r2k1; r2k2; …})
        chi2ind({r1k1; r1k2}; {r2k1; r2k2}; alpha)

    Eksempel (2×2):
        chi2ind({12; 8}; {6; 14})
        chi2ind({12; 8}; {6; 14}; 0,01)
    """
    alpha = 0.05
    rows  = []
    for a in args:
        if isinstance(a, (list, tuple)):
            rows.append([_to_float(v) for v in a])
        else:
            try:
                v = _to_float(a)
                if 0.0 < v < 1.0: alpha = v
            except Exception:
                pass

    n_rows = len(rows)
    n_cols = len(rows[0]) if rows else 0
    total  = sum(sum(r) for r in rows)
    if total == 0: return {'type': 'error', 'message': 'Kontingenstabellen er tom.'}

    row_totals = [sum(r) for r in rows]
    col_totals = [sum(rows[i][j] for i in range(n_rows)) for j in range(n_cols)]

    chi2 = 0.0
    for i in range(n_rows):
        for j in range(n_cols):
            e = row_totals[i] * col_totals[j] / total
            if e > 0:
                chi2 += (rows[i][j] - e) ** 2 / e

    df         = (n_rows - 1) * (n_cols - 1)
    p          = 1.0 - _chi2_cdf(chi2, df)
    chi2_crit  = _chi2_ppf(1.0 - alpha, df)
    alpha_pct  = f"{alpha * 100:g}%"

    return _ht_continuous(
        test_name = 'Chi²-test (uafhængighed)',
        h0        = f'De to variable er uafhængige',
        h1        = f'De to variable er afhængige',
        stat      = chi2,
        stat_sym  = 'χ²',
        df        = df,
        p_value   = p,
        alpha     = alpha,
        side      = 'right',
        extra     = {
            'table_dim':  f'{n_rows}×{n_cols}',
            'crit_value': round(chi2_crit, 4),
            'crit_fmt':   f"{chi2_crit:.4g}".replace('.', ','),
            'stat_fmt':   f"{chi2:.4g}".replace('.', ','),
        }
    )


# ─── T-TEST ───────────────────────────────────────────────────────────────────

def ttest1(data, mu0, *args):
    """
    En-stikprøve t-test: H₀: μ = μ₀

    Syntaks:
        ttest1({x1;x2;…}; mu0)
        ttest1({x1;x2;…}; mu0; alpha)
        ttest1({x1;x2;…}; mu0; less)       → H₁: μ < μ₀
        ttest1({x1;x2;…}; mu0; greater)    → H₁: μ > μ₀
        ttest1({x1;x2;…}; mu0; less; alpha)
    """
    vals  = [_to_float(v) for v in data]
    mu0_v = _to_float(mu0)
    side  = 'two'
    alpha = 0.05
    for a in args:
        s = str(a).lower().strip()
        if s in ('less', 'venstre'):      side = 'less'
        elif s in ('greater', 'højre'):   side = 'greater'
        else:
            try:
                v = _to_float(a)
                if 0.0 < v < 1.0: alpha = v
            except Exception:
                pass

    n    = len(vals)
    xbar = sum(vals) / n
    s    = math.sqrt(sum((x - xbar) ** 2 for x in vals) / (n - 1))
    df   = n - 1

    # Kanttilfælde: nul-varians (alle observationer identiske)
    if s < 1e-15:
        diff = abs(xbar - mu0_v)
        p_val = 0.0 if diff > 1e-12 else 1.0
        h1_str = {'less': f'μ < {_fmt_p(mu0_v)}',
                  'greater': f'μ > {_fmt_p(mu0_v)}'}.get(side, f'μ ≠ {_fmt_p(mu0_v)}')
        return _ht_continuous(
            test_name='T-test (én stikprøve)', h0=f'μ = {_fmt_p(mu0_v)}',
            h1=h1_str, stat=float('inf') if diff > 1e-12 else 0.0,
            stat_sym='t', df=float(df), p_value=p_val, alpha=alpha, side=side,
            extra={'n': n, 'xbar_fmt': f'{xbar:.4g}'.replace('.', ','),
                   's_fmt': '0', 'crit_value': 0.0, 'crit_fmt': '—',
                   'stat_fmt': '∞' if diff > 1e-12 else '0'}
        )

    t    = (xbar - mu0_v) / (s / math.sqrt(n))

    if side == 'less':
        p = _t_cdf(t, df)
        h1 = f'μ < {_fmt_p(mu0_v)}'
    elif side == 'greater':
        p = 1.0 - _t_cdf(t, df)
        h1 = f'μ > {_fmt_p(mu0_v)}'
    else:
        p  = 2.0 * (1.0 - _t_cdf(abs(t), df))
        h1 = f'μ ≠ {_fmt_p(mu0_v)}'

    t_crit = _t_ppf(1.0 - alpha / (1.0 if side != 'two' else 2.0), df)

    return _ht_continuous(
        test_name = 'T-test (én stikprøve)',
        h0        = f'μ = {_fmt_p(mu0_v)}',
        h1        = h1,
        stat      = t,
        stat_sym  = 't',
        df        = df,
        p_value   = p,
        alpha     = alpha,
        side      = side,
        extra     = {
            'n':          n,
            'xbar':       round(xbar, 4),
            'xbar_fmt':   f"{xbar:.4g}".replace('.', ','),
            's':          round(s, 4),
            's_fmt':      f"{s:.4g}".replace('.', ','),
            'crit_value': round(t_crit, 4),
            'crit_fmt':   f"{t_crit:.4g}".replace('.', ','),
            'stat_fmt':   f"{t:.4g}".replace('.', ','),
        }
    )


def ttest2(data1, data2, *args):
    """
    To-stikprøve t-test (Welch's) — antager ikke ens varians: H₀: μ₁ = μ₂

    Syntaks:
        ttest2({x1;x2;…}; {y1;y2;…})
        ttest2({x1;x2;…}; {y1;y2;…}; alpha)
        ttest2({x1;x2;…}; {y1;y2;…}; less)       → H₁: μ₁ < μ₂
        ttest2({x1;x2;…}; {y1;y2;…}; greater)    → H₁: μ₁ > μ₂
    """
    v1    = [_to_float(v) for v in data1]
    v2    = [_to_float(v) for v in data2]
    side  = 'two'
    alpha = 0.05
    for a in args:
        s = str(a).lower().strip()
        if s in ('less', 'venstre'):      side = 'less'
        elif s in ('greater', 'højre'):   side = 'greater'
        else:
            try:
                v = _to_float(a)
                if 0.0 < v < 1.0: alpha = v
            except Exception:
                pass

    n1, n2   = len(v1), len(v2)
    xbar1    = sum(v1) / n1
    xbar2    = sum(v2) / n2
    s1sq     = sum((x - xbar1)**2 for x in v1) / (n1 - 1)
    s2sq     = sum((x - xbar2)**2 for x in v2) / (n2 - 1)
    se_sq    = s1sq/n1 + s2sq/n2
    se       = math.sqrt(se_sq)

    # Kanttilfælde: nul-varians (identiske observationer)
    if se < 1e-15:
        diff = abs(xbar1 - xbar2)
        p_val = 0.0 if diff > 1e-12 else 1.0
        return _ht_continuous(
            test_name="T-test (to stikprøver, Welch)", h0="μ₁ = μ₂",
            h1="μ₁ ≠ μ₂ (ensidet: se ovenfor)",
            stat=float("inf") if diff > 0 else 0.0, stat_sym="t",
            df=float(n1 + n2 - 2), p_value=p_val, alpha=alpha, side=side,
            extra={"n1":n1,"n2":n2,"xbar1_fmt":f"{xbar1:.4g}".replace(".",","),
                   "xbar2_fmt":f"{xbar2:.4g}".replace(".",","),
                   "s1_fmt":"0","s2_fmt":"0",
                   "crit_value":0.0,"crit_fmt":"—","stat_fmt":"∞" if diff > 0 else "0"}
        )

    t        = (xbar1 - xbar2) / se

    # Welch-Satterthwaite frihedsgrader
    denom_ws = (s1sq/n1)**2/(n1-1) + (s2sq/n2)**2/(n2-1)
    df = se_sq**2 / denom_ws if denom_ws > 1e-15 else float(n1 + n2 - 2)

    if side == 'less':
        p  = _t_cdf(t, df)
        h1 = 'μ₁ < μ₂'
    elif side == 'greater':
        p  = 1.0 - _t_cdf(t, df)
        h1 = 'μ₁ > μ₂'
    else:
        p  = 2.0 * (1.0 - _t_cdf(abs(t), df))
        h1 = 'μ₁ ≠ μ₂'

    t_crit = _t_ppf(1.0 - alpha / (1.0 if side != 'two' else 2.0), df)

    return _ht_continuous(
        test_name = 'T-test (to stikprøver, Welch)',
        h0        = 'μ₁ = μ₂',
        h1        = h1,
        stat      = t,
        stat_sym  = 't',
        df        = df,
        p_value   = p,
        alpha     = alpha,
        side      = side,
        extra     = {
            'n1':         n1,   'n2':         n2,
            'xbar1_fmt':  f"{xbar1:.4g}".replace('.', ','),
            'xbar2_fmt':  f"{xbar2:.4g}".replace('.', ','),
            's1_fmt':     f"{math.sqrt(s1sq):.4g}".replace('.', ','),
            's2_fmt':     f"{math.sqrt(s2sq):.4g}".replace('.', ','),
            'crit_value': round(t_crit, 4),
            'crit_fmt':   f"{t_crit:.4g}".replace('.', ','),
            'stat_fmt':   f"{t:.4g}".replace('.', ','),
        }
    )
